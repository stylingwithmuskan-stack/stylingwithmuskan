export const SERVICE_TYPES = [
    {
        id: "skin",
        label: "Skin Care",
        image: "/skin_service_banner_1772177557335.png",
        description: "Facials, waxing & cleanups",
        color: "from-amber-400 to-orange-500",
        textColor: "text-amber-600",
        bgColor: "bg-amber-100"
    },
    {
        id: "hair",
        label: "Hair Services",
        image: "/hair_service_banner_1772177572229.png",
        description: "Cutting, spa & coloring",
        color: "from-blue-400 to-indigo-500",
        textColor: "text-blue-600",
        bgColor: "bg-blue-100"
    },
    {
        id: "makeup",
        label: "Makeup & More",
        image: "/makeup_service_banner_1772177590551.png",
        description: "Party, bridal & grooming",
        color: "from-pink-400 to-rose-500",
        textColor: "text-pink-600",
        bgColor: "bg-pink-100"
    }
];

export const BOOKING_TYPE_CONFIG = [
    {
        id: "instant",
        label: "Booked",
        icon: "⚡",
        description: "Pro reaches within 60 mins"
    },
    {
        id: "scheduled",
        label: "Pre-book Service",
        icon: "📅",
        description: "Choose your own date & time"
    },
    {
        id: "customize",
        label: "Custom Package",
        icon: "✨",
        description: "For events & bulk bookings"
    }
];

export const categories = [
    { id: "bridal", name: "Bridal", icon: "💍", gender: "women", serviceType: "makeup", bookingType: "instant", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face" },
    { id: "facial", name: "Facial", icon: "✨", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=150&h=150&fit=crop&crop=face" },
    { id: "waxing", name: "Waxing", icon: "🌿", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=150&h=150&fit=crop&crop=face" },
    { id: "makeup", name: "Makeup", icon: "💄", gender: "women", serviceType: "makeup", bookingType: "instant", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150&h=150&fit=crop&crop=face" },
    { id: "hairspa", name: "Hair Spa", icon: "💆‍♀️", gender: "women", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=150&h=150&fit=crop&crop=face" },
    { id: "manicure", name: "Manicure", icon: "💅", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=150&h=150&fit=crop" },
    { id: "pedicure", name: "Pedicure", icon: "🦶", gender: "women", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=150&h=150&fit=crop" },
    { id: "threading", name: "Threading", icon: "🪡", gender: "women", serviceType: "makeup", bookingType: "instant", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=150&h=150&fit=crop&crop=face" },

    // Scheduled Categories (same IDs)
    { id: "bridal", name: "Bridal", icon: "💍", gender: "women", serviceType: "makeup", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop&crop=face" },
    { id: "facial", name: "Facial", icon: "✨", gender: "women", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=150&h=150&fit=crop&crop=face" },
    { id: "waxing", name: "Waxing", icon: "🌿", gender: "women", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=150&h=150&fit=crop&crop=face" },
    { id: "makeup", name: "Makeup", icon: "💄", gender: "women", serviceType: "makeup", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=150&h=150&fit=crop&crop=face" },
    { id: "hairspa", name: "Hair Spa", icon: "💆‍♀️", gender: "women", serviceType: "hair", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=150&h=150&fit=crop&crop=face" },
    { id: "manicure", name: "Manicure", icon: "💅", gender: "women", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=150&h=150&fit=crop" },
    { id: "pedicure", name: "Pedicure", icon: "🦶", gender: "women", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1519014816548-bf5fe059798b?w=150&h=150&fit=crop" },
    { id: "threading", name: "Threading", icon: "🪡", gender: "women", serviceType: "makeup", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=150&h=150&fit=crop&crop=face" },

    // Men Categories - Instant
    { id: "haircut-m", name: "Haircut", icon: "✂️", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150&h=150&fit=crop&crop=face" },
    { id: "beard", name: "Beard Styling", icon: "🧔", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=150&h=150&fit=crop" },
    { id: "cleanup", name: "Cleanup", icon: "🧴", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
    { id: "haircolor", name: "Hair Color", icon: "🎨", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=150&h=150&fit=crop&crop=face" },
    { id: "grooming", name: "Grooming", icon: "💈", gender: "men", serviceType: "hair", bookingType: "instant", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=150&h=150&fit=crop&crop=face" },
    { id: "facial-m", name: "Facial", icon: "🧖‍♂️", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=150&h=150&fit=crop&crop=face" },
    { id: "massage-m", name: "Massage", icon: "💪", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=150&h=150&fit=crop" },
    { id: "shave", name: "Clean Shave", icon: "🪒", gender: "men", serviceType: "skin", bookingType: "instant", image: "https://images.unsplash.com/photo-1585747860019-f4e64de5ad67?w=150&h=150&fit=crop&crop=face" },

    // Men Categories - Scheduled
    { id: "haircut-m", name: "Haircut", icon: "✂️", gender: "men", serviceType: "hair", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=150&h=150&fit=crop&crop=face" },
    { id: "beard", name: "Beard Styling", icon: "🧔", gender: "men", serviceType: "hair", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=150&h=150&fit=crop" },
    { id: "cleanup", name: "Cleanup", icon: "🧴", gender: "men", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
    { id: "haircolor", name: "Hair Color", icon: "🎨", gender: "men", serviceType: "hair", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=150&h=150&fit=crop&crop=face" },
    { id: "grooming", name: "Grooming", icon: "💈", gender: "men", serviceType: "hair", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=150&h=150&fit=crop&crop=face" },
    { id: "facial-m", name: "Facial", icon: "🧖‍♂️", gender: "men", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1484517186945-df8151a1a871?w=150&h=150&fit=crop&crop=face" },
    { id: "massage-m", name: "Massage", icon: "💪", gender: "men", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=150&h=150&fit=crop" },
    { id: "shave", name: "Clean Shave", icon: "🪒", gender: "men", serviceType: "skin", bookingType: "scheduled", image: "https://images.unsplash.com/photo-1585747860019-f4e64de5ad67?w=150&h=150&fit=crop&crop=face" },
];

export const services = [
    {
        id: "s1", name: "Bridal Makeup Package", category: "bridal", gender: "women",
        price: 14999, originalPrice: 19999, duration: "3-4 hrs", rating: 4.9, reviews: 328,
        description: "Complete bridal transformation with HD makeup, hairstyling, and draping. Our expert beauticians ensure you look stunning on your special day.",
        includes: ["HD Makeup", "Hairstyling", "Saree Draping", "Touch-up Kit", "False Lashes"],
        steps: [
            { name: "Skin Prep", description: "Cleansing, toning & moisturizing for a flawless base", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=120&h=120&fit=crop" },
            { name: "Base Makeup", description: "HD foundation, concealer & setting for long wear", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=120&h=120&fit=crop" },
            { name: "Eye Makeup", description: "Eyeshadow, liner, lashes for a dramatic look", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop" },
            { name: "Hairstyling", description: "Elegant updo or style as per preference", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=120&h=120&fit=crop" },
            { name: "Final Touch", description: "Setting spray, touch-up kit handover", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=300&fit=crop"
    },
    {
        id: "s2", name: "Gold Facial", category: "facial", gender: "women",
        price: 1499, originalPrice: 1999, duration: "60 min", rating: 4.7, reviews: 512,
        description: "Luxurious gold facial that brightens and rejuvenates your skin with 24K gold elements.",
        includes: ["Cleansing", "Gold Scrub", "Gold Mask", "Moisturizing", "Sunscreen"],
        steps: [
            { name: "Cleansing", description: "Deep cleanse to remove impurities", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=120&h=120&fit=crop" },
            { name: "Exfoliation", description: "Gold scrub to remove dead cells", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=120&h=120&fit=crop" },
            { name: "Gold Mask", description: "24K gold mask for radiant glow", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop" },
            { name: "Massage", description: "Relaxing facial massage", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=120&h=120&fit=crop" },
            { name: "Moisturize", description: "Hydrate & protect with SPF", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=300&fit=crop"
    },
    {
        id: "s3", name: "Full Body Waxing", category: "waxing", gender: "women",
        price: 1999, originalPrice: 2999, duration: "90 min", rating: 4.5, reviews: 890,
        description: "Complete body waxing with premium chocolate wax for smooth, hair-free skin.",
        includes: ["Full Arms", "Full Legs", "Underarms", "Stomach", "Back", "Post-wax Gel"],
        steps: [
            { name: "Prep Skin", description: "Clean & prep skin for waxing", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=120&h=120&fit=crop" },
            { name: "Wax Apply", description: "Apply premium chocolate wax", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=120&h=120&fit=crop" },
            { name: "Hair Remove", description: "Gentle hair removal technique", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop" },
            { name: "Soothe", description: "Apply post-wax gel to soothe skin", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=400&h=300&fit=crop"
    },
    {
        id: "s4", name: "Party Makeup", category: "makeup", gender: "women",
        price: 2999, originalPrice: 3999, duration: "90 min", rating: 4.8, reviews: 245,
        description: "Glamorous party-ready look with airbrush makeup and professional hairstyling.",
        includes: ["Airbrush Makeup", "Hairstyling", "False Lashes", "Touch-up Kit"],
        steps: [
            { name: "Base Prep", description: "Primer & foundation for smooth base", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=120&h=120&fit=crop" },
            { name: "Airbrush", description: "Airbrush makeup application", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop" },
            { name: "Eyes & Lips", description: "Smokey eyes & lip color", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=120&h=120&fit=crop" },
            { name: "Hair Style", description: "Curls, waves or updo styling", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=400&h=300&fit=crop"
    },
    {
        id: "s5", name: "Hair Spa Treatment", category: "hairspa", gender: "women",
        price: 1299, originalPrice: 1799, duration: "75 min", rating: 4.6, reviews: 367,
        description: "Deep conditioning hair spa with keratin treatment for silky smooth hair.",
        includes: ["Hair Wash", "Deep Conditioning", "Keratin Mask", "Head Massage", "Blow Dry"],
        steps: [
            { name: "Hair Wash", description: "Gentle shampoo & rinse", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=120&h=120&fit=crop" },
            { name: "Condition", description: "Deep conditioning treatment", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=120&h=120&fit=crop" },
            { name: "Keratin", description: "Keratin mask application", image: "https://images.unsplash.com/photo-1540555700478-4be289fbec6d?w=120&h=120&fit=crop" },
            { name: "Massage", description: "Relaxing head massage", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=120&h=120&fit=crop" },
            { name: "Blow Dry", description: "Professional blow dry finish", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=300&fit=crop"
    },
    {
        id: "s6", name: "Classic Haircut", category: "haircut-m", gender: "men",
        price: 399, originalPrice: 599, duration: "30 min", rating: 4.6, reviews: 1200,
        description: "Professional haircut with styling by experienced barbers at your home.",
        includes: ["Hair Wash", "Haircut", "Styling", "Towel Service"],
        steps: [
            { name: "Consult", description: "Style discussion with barber", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&h=120&fit=crop" },
            { name: "Wash", description: "Hair wash with premium shampoo", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=120&h=120&fit=crop" },
            { name: "Cut", description: "Precision cut as per style", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=120&h=120&fit=crop" },
            { name: "Style", description: "Final styling & finishing", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=300&fit=crop"
    },
    {
        id: "s7", name: "Beard Styling & Trim", category: "beard", gender: "men",
        price: 299, originalPrice: 499, duration: "25 min", rating: 4.7, reviews: 856,
        description: "Professional beard shaping and grooming for a clean, sharp look.",
        includes: ["Beard Wash", "Trim & Shape", "Beard Oil", "Hot Towel"],
        steps: [
            { name: "Beard Wash", description: "Cleanse with beard shampoo", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=120&h=120&fit=crop" },
            { name: "Trim", description: "Precision trimming & shaping", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&h=120&fit=crop" },
            { name: "Hot Towel", description: "Relaxing hot towel treatment", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=120&h=120&fit=crop" },
            { name: "Oil & Style", description: "Beard oil & final styling", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=400&h=300&fit=crop"
    },
    {
        id: "s8", name: "Face Cleanup", category: "cleanup", gender: "men",
        price: 599, originalPrice: 899, duration: "40 min", rating: 4.5, reviews: 423,
        description: "Deep cleansing facial cleanup to remove dirt, oil, and dead skin cells.",
        includes: ["Face Wash", "Scrub", "Steam", "Extraction", "Pack", "Moisturizer"],
        steps: [
            { name: "Cleanse", description: "Deep cleansing face wash", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop" },
            { name: "Scrub", description: "Exfoliate dead skin cells", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=120&h=120&fit=crop" },
            { name: "Steam", description: "Open pores with steam", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&h=120&fit=crop" },
            { name: "Pack", description: "Apply face pack & moisturize", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=300&fit=crop"
    },
    {
        id: "s9", name: "Hair Color", category: "haircolor", gender: "men",
        price: 799, originalPrice: 1199, duration: "45 min", rating: 4.4, reviews: 312,
        description: "Professional hair coloring with premium ammonia-free colors.",
        includes: ["Color Consultation", "Premium Color", "Application", "Wash & Style"],
        steps: [
            { name: "Consult", description: "Color shade selection", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=120&h=120&fit=crop" },
            { name: "Prep", description: "Protect skin & prep hair", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&h=120&fit=crop" },
            { name: "Apply", description: "Precise color application", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=120&h=120&fit=crop" },
            { name: "Wash & Style", description: "Rinse & style finish", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=400&h=300&fit=crop"
    },
    {
        id: "s10", name: "Grooming Package", category: "grooming", gender: "men",
        price: 1499, originalPrice: 2199, duration: "90 min", rating: 4.8, reviews: 678,
        description: "Complete grooming package including haircut, beard trim, facial, and more.",
        includes: ["Haircut", "Beard Trim", "Face Cleanup", "Head Massage", "Styling"],
        steps: [
            { name: "Haircut", description: "Professional haircut", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=120&h=120&fit=crop" },
            { name: "Beard Trim", description: "Shape & trim beard", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=120&h=120&fit=crop" },
            { name: "Face Clean", description: "Deep cleansing facial", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop" },
            { name: "Massage", description: "Relaxing head massage", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=120&h=120&fit=crop" },
            { name: "Final Style", description: "Styling & grooming finish", image: "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=120&h=120&fit=crop" },
        ],
        image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=400&h=300&fit=crop"
    },
];
export const banners = {
    women: [
        { id: 1, title: "Bridal Season Special", subtitle: "Flat 20% off on all bridal packages", gradient: "from-pink-200 via-rose-100 to-amber-100", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=800&h=400&fit=crop", cta: "Book Now" },
        { id: 2, title: "Glow Up Facial Fest", subtitle: "Premium facials starting ₹999", gradient: "from-purple-200 via-pink-100 to-rose-100", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=800&h=400&fit=crop", cta: "Explore" },
        { id: 3, title: "Monsoon Hair Spa", subtitle: "Repair & nourish your hair this season", gradient: "from-teal-100 via-pink-50 to-rose-100", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=400&fit=crop", cta: "Get Offer" },
    ],
    men: [
        { id: 1, title: "Grooming Essentials", subtitle: "Complete grooming package at ₹999", gradient: "from-slate-700 via-slate-600 to-blue-900", image: "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&h=400&fit=crop", cta: "Book Now" },
        { id: 2, title: "Beard Boss Sale", subtitle: "Beard styling + haircut combo ₹549", gradient: "from-gray-800 via-slate-700 to-indigo-900", image: "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&h=400&fit=crop", cta: "Grab Deal" },
        { id: 3, title: "Fresh Cut Friday", subtitle: "Flat 30% off on all haircuts", gradient: "from-zinc-800 via-gray-700 to-slate-800", image: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=800&h=400&fit=crop", cta: "Get Offer" },
    ],
};
export const mockProviders = [
    {
        id: "p1",
        name: "Muskan Sharma",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop",
        tag: "Best Rated",
        rating: 4.9,
        experience: "8+ Years",
        totalJobs: 1250,
        specialties: ["makeup", "skin", "hair"]
    },
    {
        id: "p2",
        name: "Priya Verma",
        image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop",
        tag: "Top Choice",
        rating: 4.8,
        experience: "5+ Years",
        totalJobs: 890,
        specialties: ["skin", "makeup"]
    },
    {
        id: "p3",
        name: "Rahul Khanna",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop",
        tag: "Professional",
        rating: 4.7,
        experience: "6+ Years",
        totalJobs: 750,
        specialties: ["hair"]
    },
    {
        id: "p4",
        name: "Anjali Gupta",
        image: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=150&h=150&fit=crop",
        tag: "Expert",
        rating: 4.6,
        experience: "4+ Years",
        totalJobs: 420,
        specialties: ["skin", "hair"]
    }
];

export const initialSpotlights = [
    {
        id: "1",
        title: "Home Makeup Art",
        category: "Makeup",
        video: "https://assets.mixkit.co/videos/preview/mixkit-makeup-artist-applying-eyeshadow-on-a-customer-34167-large.mp4",
        poster: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=400&h=600&fit=crop"
    },
    {
        id: "2",
        title: "Hair Transformation",
        category: "Hair",
        video: "https://assets.mixkit.co/videos/preview/mixkit-stylist-combing-a-customer-s-hair-34162-large.mp4",
        poster: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=400&h=600&fit=crop"
    },
    {
        id: "3",
        title: "Skin Rejuvenation",
        category: "Skin",
        video: "https://assets.mixkit.co/videos/preview/mixkit-beautician-performing-a-facial-treatment-on-a-customer-34164-large.mp4",
        poster: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=400&h=600&fit=crop"
    },
    {
        id: "4",
        title: "Bridal Perfection",
        category: "Bridal",
        video: "https://assets.mixkit.co/videos/preview/mixkit-hair-stylist-spraying-hair-of-a-customer-34163-large.mp4",
        poster: "https://images.unsplash.com/photo-1583089892943-e02e5b017b6a?w=400&h=600&fit=crop"
    },
    {
        id: "5",
        title: "Classic Styling",
        category: "Hair",
        video: "https://assets.mixkit.co/videos/preview/mixkit-woman-smiling-while-beautician-applies-a-face-mask-34158-large.mp4",
        poster: "https://images.unsplash.com/photo-1559599101-f09722fb4948?w=400&h=600&fit=crop"
    }
];

export const initialGallery = [
    { id: "1", image: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=1000&h=800&fit=crop", title: "Luxury Suite" },
    { id: "2", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=1000&h=800&fit=crop", title: "Makeup Studio" },
    { id: "3", image: "https://images.unsplash.com/photo-1596755389378-c31d21fd1273?w=1000&h=800&fit=crop", title: "Private Spa Area" },
    { id: "4", image: "https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=1000&h=800&fit=crop", title: "Relaxation Lounge" },
    { id: "5", image: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=1000&h=800&fit=crop", title: "Style Zone" },
];

export const initialTestimonials = [
    { id: "1", name: "Kabita Debnath", rating: 5, feedback: "My experience was fabulous. I used this app for the first time and loved it. This was a very wonderful experience from beginning. I would highly recommend her.", image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&crop=face" },
    { id: "2", name: "Sneha Roy", rating: 4, feedback: "The beautician was very professional and skilled. I've tried other salon services, but this is the best. Their prices are reasonable and service is top-notch.", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&crop=face" },
    { id: "3", name: "Priya Sharma", rating: 5, feedback: "Excellent service at my doorstep! The team is always on time and maintain great hygiene. Highly recommend for bridal makeup.", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&crop=face" },
    { id: "4", name: "Anjali Gupta", rating: 5, feedback: "Absolutely loved the facial! My skin feels so much better. The professional was very informative about skin types.", image: "https://images.unsplash.com/photo-1554151228-14d9def656e4?w=100&h=100&crop=face" },
];
