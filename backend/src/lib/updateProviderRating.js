import Feedback from "../models/Feedback.js";
import ProviderAccount from "../models/ProviderAccount.js";

/**
 * Recalculate and update provider's average rating based on all feedback
 * @param {string} providerId - Provider's ID
 */
export async function updateProviderRating(providerId) {
  if (!providerId) return;

  try {
    // Get all active feedback for this provider
    const feedbacks = await Feedback.find({
      providerId,
      type: "customer_to_provider",
      status: "active",
    }).lean();

    if (feedbacks.length === 0) {
      // No feedback yet, set rating to 0
      await ProviderAccount.findByIdAndUpdate(providerId, {
        rating: 0,
      });
      return;
    }

    // Calculate average rating
    const totalRating = feedbacks.reduce((sum, f) => sum + f.rating, 0);
    const avgRating = totalRating / feedbacks.length;

    // Update provider's rating (rounded to 1 decimal)
    await ProviderAccount.findByIdAndUpdate(providerId, {
      rating: Math.round(avgRating * 10) / 10,
    });
  } catch (error) {
    console.error("Error updating provider rating:", error);
  }
}
