'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const us = (sec) => Math.round(sec * 1_000_000); 
const uid = () => crypto.randomUUID();
function defaultDraftsDir() {
  if (process.env.CUPCUT_DRAFTS_DIR) return process.env.CUPCUT_DRAFTS_DIR;
  const local = process.env.LOCALAPPDATA || '';
  if (local) {
    return path.join(local, 'CapCut', 'User Data', 'Projects', 'com.lveditor.draft');
  }
  return path.resolve(process.cwd(), 'capcut-drafts');
}

function videoMaterial({ id, videoPath, meta }) {
  return {
    id,
    path: videoPath,
    material_name: path.basename(videoPath),
    type: 'video',
    duration: us(meta.duration || 0),
    width: meta.width || 1920,
    height: meta.height || 1080,
    category_name: 'local',
    check_flag: 63487,
    crop: { lower_left_x: 0, lower_left_y: 1, lower_right_x: 1, lower_right_y: 1, upper_left_x: 0, upper_left_y: 0, upper_right_x: 1, upper_right_y: 0 },
    crop_ratio: 'free',
    crop_scale: 1,
    video_algorithm: {},
    stabilize: { time_range: {}, mode: 0, strength: 0 },
    matting: { path: '', material_id: '', human_matting_result: '', enable_matting_stroke: false, enable_smart_matting: false, enable_matting_shadow: false, enable_smart_color_adjust: false, enable_color_matting: false, enable_background_blur: false, enable_background: false, enable_all_color_matting: false, enable_all_color_bgremove: false, enable_all_color_matting_bgremove: false, enable_all_color_matting_bgremove_shadow: false, enable_all_color_matting_bgremove_shadow_blur: false, enable_all_color_matting_bgremove_shadow_blur_bg: false, enable_all_color_matting_bgremove_shadow_blur_bg_color: false },
  };
}

function videoSegment({ id, materialId, srcStart, srcDur, timelineStart }) {
  return {
    id,
    material_id: materialId,
    target_timerange: { start: us(timelineStart), duration: us(srcDur) },
    source_timerange: { start: us(srcStart), duration: us(srcDur) },
    render_timerange: { start: us(timelineStart), duration: us(srcDur) },
    clip: {
      alpha: 1,
      rotation: 0,
      scale: { x: 1, y: 1 },
      transform: { x: 0, y: 1 },
      flip: { horizontal: false, vertical: false },
    },
    uniform_scale: { on: true, value: 1 },
    visible: true,
    volume: 1,
    speed: 1,
  };
}

function textMaterial({ id, content }) {
  return {
    id,
    content,
    type: 'text',
    font_size: 15,
    font_color: '#FFFFFF',
    font_path: '',
    font_name: '',
    font_id: '',
    font_resource_id: '',
    initial_scale: 1,
    check_flag: 7,
  };
}

function textSegment({ id, materialId, srcStart, srcDur, timelineStart }) {
  return {
    id,
    material_id: materialId,
    target_timerange: { start: us(timelineStart), duration: us(srcDur) },
    source_timerange: { start: 0, duration: us(srcDur) },
    render_timerange: { start: us(timelineStart), duration: us(srcDur) },
    clip: {
      alpha: 1,
      rotation: 0,
      scale: { x: 1, y: 1 },
      transform: { x: 0, y: -0.8 },
      flip: { horizontal: false, vertical: false },
    },
    uniform_scale: { on: true, value: 1 },
    visible: true,
  };
}

/**
 * Build a CapCut draft folder from an edit plan.
 *
 * @param {object} opts
 * @param {string} opts.name        
 * @param {string} opts.videoPath   
 * @param {object} opts.meta        
 * @param {Array}  opts.keeps       
 * @param {Array}  opts.captions    
 * @param {string} [opts.draftsDir] 
 * @returns {{ draftDir, draftName, files }}
 */
function buildCapCutDraft({ name, videoPath, meta, keeps, captions = [], draftsDir }) {
  const dir = draftsDir || defaultDraftsDir();
  const safeName = String(name || 'smart-cut').replace(/[\\/:*?"<>|]/g, '-').slice(0, 60);
  const draftName = `${safeName}-${Date.now().toString(36)}`;
  const draftDir = path.join(dir, draftName);
  fs.mkdirSync(draftDir, { recursive: true });

  const draftId = uid();
  const nowUs = Date.now() * 1000;
  const fps = meta.fps || 30;
  const videoMatId = uid();
  const videoSegments = [];
  let cursor = 0;
  for (const k of keeps) {
    const dur = k.end - k.start;
    if (dur <= 0.05) continue;
    videoSegments.push(
      videoSegment({
        id: uid(),
        materialId: videoMatId,
        srcStart: k.start,
        srcDur: dur,
        timelineStart: cursor,
      })
    );
    cursor += dur;
  }
  const totalDur = cursor;
  const textMaterials = [];
  const textSegments = [];
  const mapTime = (t) => {
    let acc = 0;
    for (const k of keeps) {
      if (t < k.start) return null;
      if (t <= k.end) return acc + (t - k.start);
      acc += k.end - k.start;
    }
    return null;
  };

  for (const c of captions) {
    const ts = mapTime(c.start);
    const te = mapTime(c.end);
    if (ts == null || te == null || te - ts <= 0.05) continue;
    const matId = uid();
    textMaterials.push(textMaterial({ id: matId, content: c.text }));
    textSegments.push(
      textSegment({
        id: uid(),
        materialId: matId,
        srcStart: 0,
        srcDur: te - ts,
        timelineStart: ts,
      })
    );
  }

  const tracks = [];
  if (videoSegments.length) {
    tracks.push({ type: 'video', segments: videoSegments, id: uid() });
  }
  if (textSegments.length) {
    tracks.push({ type: 'text', segments: textSegments, id: uid() });
  }

  const draftContent = {
    id: draftId,
    name: draftName,
    duration: us(totalDur),
    create_time: nowUs,
    update_time: nowUs,
    fps,
    canvas_config: {
      width: meta.width || 1920,
      height: meta.height || 1080,
      ratio: 'original',
    },
    tracks,
    materials: {
      videos: [videoMaterial({ id: videoMatId, videoPath, meta })],
      texts: textMaterials,
      audios: [],
      material_animations: [],
      speeds: [],
      placeholder_infos: [],
      sound_channel_mappings: [],
      vocal_separations: [],
    },
    keyframe_graph_list: [],
    platform: 'windows',
    version: '8.0.0',
    new_version: '8.0.0',
    render_index_track_mode_on: false,
    free_render_index_mode_on: false,
    render_index_track_mode: 'normal',
  };

  const draftMeta = {
    cloud_draft_cover: false,
    cloud_draft_sync: false,
    draft_cloud_capcut_purchase_info: '',
    draft_cloud_last_action_download: false,
    draft_cloud_package_type: '',
    draft_cloud_purchase_info: '',
    draft_cloud_template_id: '',
    draft_cloud_tutorial_info: '',
    draft_cloud_videocut_purchase_info: '',
    draft_cover: '',
    draft_deeplink_url: '',
    draft_enterprise_info: {
      draft_enterprise_extra: '',
      draft_enterprise_id: '',
      draft_enterprise_name: '',
      draft_enterprise_package_id: '',
      draft_enterprise_pay_type: '',
    },
    draft_fold_path: draftDir,
    draft_id: draftId,
    draft_is_ai_packaging_used: false,
    draft_is_ai_shorts: false,
    draft_is_ai_translate: false,
    draft_is_article_video_draft: false,
    draft_is_from_deeplink: 'false',
    draft_is_invisible: false,
    draft_materials: [
      {
        type: 0,
        value: [
          {
            ai_group_type: '',
            create_time: Math.floor(nowUs / 1000),
            duration: us(meta.duration || 0),
            enter_from: '',
            extra_info: '',
            file_Path: videoPath,
            height: meta.height || 1080,
            id: videoMatId,
            import_time_ms: Date.now(),
            import_time_s: Math.floor(Date.now() / 1000),
            item_source: 1,
            md5: '',
            metetype: 'video',
            roughcut_time_range: { duration: -1, start: -1 },
            sub_time_range: { duration: -1, start: -1 },
            type: 0,
            width: meta.width || 1920,
          },
        ],
      },
    ],
    draft_materials_copied: false,
    draft_name: draftName,
    draft_new_version: '',
    draft_removable_storage_device: '',
    draft_root_path: draftDir,
    draft_segment_extra_info: [],
    draft_type: '',
    tm_draft_cloud_completed: '',
    tm_draft_cloud_entry_id: -1,
    tm_draft_cloud_modified: 0,
    tm_draft_cloud_parent_entry_id: -1,
    tm_draft_cloud_space_id: -1,
    tm_draft_cloud_user_id: -1,
    tm_draft_create: Math.floor(nowUs / 1000),
    tm_draft_modified: Math.floor(nowUs / 1000),
    tm_draft_removed: 0,
    tm_duration: us(totalDur),
  };

  fs.writeFileSync(path.join(draftDir, 'draft_content.json'), JSON.stringify(draftContent, null, 2));
  fs.writeFileSync(path.join(draftDir, 'draft_meta_info.json'), JSON.stringify(draftMeta, null, 2));

  return { draftDir, draftName, files: ['draft_content.json', 'draft_meta_info.json'] };
}

module.exports = { buildCapCutDraft, defaultDraftsDir };
