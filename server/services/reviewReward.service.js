/**
 * reviewReward.service.js
 *
 * Credits wallet reward points when a user submits a qualifying product
 * review (rating >= configured minimum). One reward per user per product —
 * enforced by the @@unique([userId, productId, source]) constraint on
 * reward_transactions plus a pre-check.
 */
const prisma = require('../lib/prisma');

const SOURCE = 'REVIEW';

async function getConfig() {
  let config = await prisma.reviewRewardConfig.findFirst();
  if (!config) {
    config = await prisma.reviewRewardConfig.create({
      data: { enabled: false, minRating: 4, amount: 0, currency: 'ETB' },
    });
  }
  return config;
}

/**
 * Attempt to credit a review reward.
 * @returns {Promise<{credited:boolean, amount?:number, currency?:string, reason?:string}>}
 */
async function creditReviewReward({ userId, productId, rating, reviewId }) {
  try {
    const config = await getConfig();
    if (!config.enabled) return { credited: false, reason: 'disabled' };
    if (!config.amount || Number(config.amount) <= 0) {
      return { credited: false, reason: 'no_amount' };
    }
    if (rating < config.minRating) {
      return { credited: false, reason: 'rating_too_low' };
    }

    // Strict one-reward-per-product rule
    const existing = await prisma.rewardTransaction.findUnique({
      where: {
        userId_productId_source: { userId, productId, source: SOURCE },
      },
    });
    if (existing) return { credited: false, reason: 'already_rewarded' };

    const tx = await prisma.rewardTransaction.create({
      data: {
        userId,
        type: 'CREDIT',
        amount: config.amount,
        currency: config.currency || 'ETB',
        source: SOURCE,
        reviewId: reviewId || null,
        productId,
        note: `Review reward for ${rating}-star review`,
      },
    });

    return {
      credited: true,
      amount: Number(tx.amount),
      currency: tx.currency,
      transactionId: tx.id,
    };
  } catch (error) {
    // Unique-constraint race → treat as already rewarded
    if (error?.code === 'P2002') {
      return { credited: false, reason: 'already_rewarded' };
    }
    console.error('Review reward credit failed:', error);
    return { credited: false, reason: 'error' };
  }
}

module.exports = { getConfig, creditReviewReward };
