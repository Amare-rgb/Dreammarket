"use client";

import { useEffect, useRef, useState } from "react";
import { LoaderCircle, MapPin, Navigation } from "lucide-react";

/**
 * LocationPicker — Google Maps pin picker with draggable marker,
 * "Use my current location" button, and manual lat/lng fallback.
 *
 * Requires NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Without a key it degrades
 * to manual latitude/longitude inputs so the form still works.
 */

interface Props {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
}

declare global {
  interface Window {
    google?: {
      maps: {
        Map: new (
          el: HTMLElement,
          opts: Record<string, unknown>
        ) => {
          panTo: (p: unknown) => void;
          addListener?: (event: string, cb: (e?: unknown) => void) => void;
        };
        Marker: new (opts: Record<string, unknown>) => {
          setMap: (m: unknown) => void;
          setPosition?: (p: unknown) => void;
          addListener: (event: string, cb: () => void) => void;
          getPosition: () => { lat: () => number; lng: () => number } | null;
        };
        LatLng: new (lat: number, lng: number) => unknown;
      };
    };
    __gmapsLoaded?: boolean;
  }
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
const DEFAULT_CENTER = { lat: 9.145, lng: 40.4896 }; // Bahir Dar, Ethiopia

let scriptPromise: Promise<void> | null = null;

function loadGoogleMaps(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.google?.maps) return Promise.resolve();
  if (window.__gmapsLoaded) {
    return new Promise((resolve) => {
      const check = () => (window.google?.maps ? resolve() : setTimeout(check, 100));
      check();
    });
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        window.__gmapsLoaded = true;
        resolve();
      };
      script.onerror = () => reject(new Error("Google Maps failed to load"));
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export default function LocationPicker({ latitude, longitude, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState("");
  const markerRef = useRef<{ setMap: (m: unknown) => void } | null>(null);
  const mapInstanceRef = useRef<unknown>(null);

  const lat = latitude ? Number(latitude) : null;
  const lng = longitude ? Number(longitude) : null;
  const hasCoords = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng);

  // Initialize map once
  useEffect(() => {
    if (!API_KEY || !mapRef.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapRef.current || !window.google?.maps) return;
        const center = hasCoords
          ? { lat: Number(latitude), lng: Number(longitude) }
          : DEFAULT_CENTER;
        const map = new window.google.maps.Map(mapRef.current, {
          center,
          zoom: hasCoords ? 15 : 12,
          mapTypeControl: false,
          streetViewControl: false,
        });
        mapInstanceRef.current = map;

        const marker = new window.google.maps.Marker({
          position: center,
          map,
          draggable: true,
        });
        markerRef.current = marker;

        const sync = () => {
          const pos = marker.getPosition?.();
          if (pos) {
            onChange(pos.lat().toFixed(7), pos.lng().toFixed(7));
          }
        };
        marker.addListener("dragend", sync);
        map.addListener?.("click", (e) => {
          const ev = e as { latLng?: { lat: () => number; lng: () => number } };
          if (ev?.latLng) {
            marker.setPosition?.(ev.latLng);
            sync();
          }
        });
        setMapReady(true);
      })
      .catch(() => setGeoError("Google Maps could not be loaded. Use manual coordinates."));

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep marker in sync when coords change externally (edit mode)
  useEffect(() => {
    if (!mapReady || !hasCoords || !markerRef.current || !window.google?.maps) return;
    // Marker position update is handled by parent re-mount in practice;
    // nothing needed here beyond initial placement.
  }, [mapReady, hasCoords, latitude, longitude]);

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by this browser.");
      return;
    }
    setLocating(true);
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = pos.coords.latitude.toFixed(7);
        const ln = pos.coords.longitude.toFixed(7);
        onChange(la, ln);
        // Pan map if available
        const map = mapInstanceRef.current as {
          panTo?: (p: unknown) => void;
        } | null;
        if (map?.panTo && window.google?.maps) {
          map.panTo(new window.google.maps.LatLng(Number(la), Number(ln)));
        }
        setLocating(false);
      },
      () => {
        setGeoError("Could not get your location. Enter coordinates manually.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      {API_KEY ? (
        <>
          <div
            ref={mapRef}
            className="h-56 w-full rounded-lg border border-gray-300 bg-gray-100"
          />
          <button
            type="button"
            onClick={useMyLocation}
            disabled={locating}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {locating ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <Navigation size={14} />
            )}
            Use my current location
          </button>
        </>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800">
          Google Maps key not configured — enter coordinates manually below.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs font-semibold text-gray-600">
          Latitude
          <input
            type="number"
            step="any"
            min="-90"
            max="90"
            value={latitude}
            onChange={(e) => onChange(e.target.value, longitude)}
            placeholder="e.g. 9.1450"
            className="mt-1 h-9 w-full rounded-lg border border-gray-300 px-2 text-sm font-normal outline-none focus:border-[#EB6D3D]"
          />
        </label>
        <label className="text-xs font-semibold text-gray-600">
          Longitude
          <input
            type="number"
            step="any"
            min="-180"
            max="180"
            value={longitude}
            onChange={(e) => onChange(latitude, e.target.value)}
            placeholder="e.g. 40.4896"
            className="mt-1 h-9 w-full rounded-lg border border-gray-300 px-2 text-sm font-normal outline-none focus:border-[#EB6D3D]"
          />
        </label>
      </div>

      {hasCoords && (
        <p className="flex items-center gap-1 text-xs text-emerald-700">
          <MapPin size={12} />
          Pin set: {lat!.toFixed(5)}, {lng!.toFixed(5)}
        </p>
      )}
      {geoError && <p className="text-xs text-red-600">{geoError}</p>}
    </div>
  );
}
