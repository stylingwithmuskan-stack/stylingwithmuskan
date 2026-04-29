/**
 * Service Availability & Exception Checking Utilities
 * 
 * This module provides functions to check service-level exceptions (disabledDates)
 * across the service hierarchy (Service → Category → ServiceType).
 * 
 * @module serviceAvailability
 */

import { Service, Category, ServiceType } from "../models/Content.js";

/**
 * Check if any service in the list has exceptions on the given date
 * 
 * @param {string[]} serviceIds - Array of service IDs to check
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} Block information
 * @returns {boolean} return.isFullyBlocked - True if service is blocked for entire day
 * @returns {Array} return.partialBlocks - Array of partial time blocks
 * @returns {string} return.blockedService - Name of the blocked service
 */
export async function checkServiceExceptions(serviceIds, date) {
  if (!Array.isArray(serviceIds) || serviceIds.length === 0 || !date) {
    return { isFullyBlocked: false, partialBlocks: [], blockedService: null };
  }

  try {
    // Fetch all services with their disabledDates
    const services = await Service.find({ 
      id: { $in: serviceIds } 
    }).select('id name disabledDates category gender').lean();

    if (!services || services.length === 0) {
      return { isFullyBlocked: false, partialBlocks: [], blockedService: null };
    }

    // Check each service in the hierarchy
    for (const service of services) {
      // 1. Check service-level disabledDates
      const serviceBlock = checkDisabledDate(service.disabledDates, date);
      if (serviceBlock) {
        return {
          isFullyBlocked: serviceBlock.fullDay,
          partialBlocks: serviceBlock.fullDay ? [] : [serviceBlock],
          blockedService: service.name
        };
      }

      // 2. Check category-level disabledDates
      if (service.category) {
        const category = await Category.findOne({ 
          id: service.category,
          gender: service.gender 
        }).select('disabledDates serviceType').lean();

        if (category?.disabledDates) {
          const catBlock = checkDisabledDate(category.disabledDates, date);
          if (catBlock) {
            return {
              isFullyBlocked: catBlock.fullDay,
              partialBlocks: catBlock.fullDay ? [] : [catBlock],
              blockedService: service.name
            };
          }

          // 3. Check service-type-level disabledDates
          if (category.serviceType) {
            const serviceType = await ServiceType.findOne({ 
              id: category.serviceType 
            }).select('disabledDates').lean();

            if (serviceType?.disabledDates) {
              const typeBlock = checkDisabledDate(serviceType.disabledDates, date);
              if (typeBlock) {
                return {
                  isFullyBlocked: typeBlock.fullDay,
                  partialBlocks: typeBlock.fullDay ? [] : [typeBlock],
                  blockedService: service.name
                };
              }
            }
          }
        }
      }
    }

    return { isFullyBlocked: false, partialBlocks: [], blockedService: null };
  } catch (error) {
    console.error("[serviceAvailability] Error checking service exceptions:", error);
    // Fail-open: return no blocks on error to avoid breaking booking flow
    return { isFullyBlocked: false, partialBlocks: [], blockedService: null };
  }
}

/**
 * Check if a specific date is in the disabledDates array
 * 
 * @param {Array} disabledDates - Array of disabled date objects
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Object|null} Block object if found, null otherwise
 */
export function checkDisabledDate(disabledDates, date) {
  if (!Array.isArray(disabledDates) || disabledDates.length === 0 || !date) {
    return null;
  }

  const block = disabledDates.find(block => block.date === date);
  return block || null;
}

/**
 * Check if a time slot falls within a blocked time range
 * 
 * @param {string} slotTime - Time in "HH:MM AM/PM" format (e.g., "03:00 PM")
 * @param {string} startTime - Start time in "HH:MM" 24-hour format (e.g., "14:00")
 * @param {string} endTime - End time in "HH:MM" 24-hour format (e.g., "17:00")
 * @returns {boolean} True if slot is within blocked range
 */
export function isTimeInRange(slotTime, startTime, endTime) {
  if (!slotTime || !startTime || !endTime) {
    return false;
  }

  try {
    // Convert slot time from "03:00 PM" to 24-hour format "15:00"
    const slot24 = convertTo24Hour(slotTime);
    
    // Compare times as numbers (e.g., "15:00" → 1500)
    const slotNum = parseInt(slot24.replace(':', ''), 10);
    const startNum = parseInt(startTime.replace(':', ''), 10);
    const endNum = parseInt(endTime.replace(':', ''), 10);

    return slotNum >= startNum && slotNum < endNum;
  } catch (error) {
    console.error("[serviceAvailability] Error in isTimeInRange:", error);
    return false;
  }
}

/**
 * Convert 12-hour time format to 24-hour format
 * 
 * @param {string} time12 - Time in "HH:MM AM/PM" format
 * @returns {string} Time in "HH:MM" 24-hour format
 */
function convertTo24Hour(time12) {
  if (!time12 || typeof time12 !== 'string') {
    return '00:00';
  }

  const [time, period] = time12.trim().split(' ');
  if (!time || !period) {
    return '00:00';
  }

  let [hours, minutes] = time.split(':').map(Number);
  
  if (period.toUpperCase() === 'PM' && hours !== 12) {
    hours += 12;
  } else if (period.toUpperCase() === 'AM' && hours === 12) {
    hours = 0;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/**
 * Filter out time slots that fall within blocked time ranges
 * 
 * @param {string[]} slots - Array of time slots in "HH:MM AM/PM" format
 * @param {Array} partialBlocks - Array of partial block objects with startTime and endTime
 * @returns {string[]} Filtered array of available slots
 */
export function filterBlockedTimeSlots(slots, partialBlocks) {
  if (!Array.isArray(slots) || slots.length === 0) {
    return [];
  }

  if (!Array.isArray(partialBlocks) || partialBlocks.length === 0) {
    return slots;
  }

  try {
    return slots.filter(slot => {
      // Check if slot falls within any blocked time range
      const isBlocked = partialBlocks.some(block => {
        if (!block.startTime || !block.endTime) {
          return false;
        }
        return isTimeInRange(slot, block.startTime, block.endTime);
      });

      return !isBlocked;
    });
  } catch (error) {
    console.error("[serviceAvailability] Error filtering blocked slots:", error);
    // On error, return original slots to avoid breaking flow
    return slots;
  }
}
