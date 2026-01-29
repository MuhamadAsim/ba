import HeroContent from '../models/heroContentModel.js';
import FeaturesContent from '../models/featuresContentModel.js';
import AboutUsContent from '../models/aboutUsContentModel.js';
import JoinNetworkContent from '../models/JoinNetworkContent.js';








// Get hero content
export const getHeroContent = async (req, res) => {
  try {
    let content = await HeroContent.findOne();
    
    if (!content) {
      // Create default content if none exists
      const defaultContent = await HeroContent.create({
        heading: "Transform Your Ride with Expert Auto Care",
        paragraph: "Discover top-tier professionals for PPF, wraps, tinting, and ceramic coating. Compare bids, explore services, and elevate your vehicle's look with unmatched quality.",
        cardImages: {
          frontImage: "",
          backImage: ""
        },
        galleryImages: ["", "", "", "", ""],
        ctaText: "Get Your Free Bid",
        badgeText: "Premium Vehicle Transformation",
        galleryCaption: "Featured transformations from our network of professionals"
      });
      
      return res.status(200).json({
        success: true,
        data: defaultContent
      });
    }
    
    // Ensure galleryImages array has exactly 5 elements
    if (!content.galleryImages || !Array.isArray(content.galleryImages)) {
      content.galleryImages = ["", "", "", "", ""];
    } else {
      while (content.galleryImages.length < 5) {
        content.galleryImages.push("");
      }
      content.galleryImages = content.galleryImages.slice(0, 5);
    }
    
    // Ensure cardImages exists
    if (!content.cardImages) {
      content.cardImages = {
        frontImage: "",
        backImage: ""
      };
    }
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching hero content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch content' 
    });
  }
};







// Create hero content
export const createHeroContent = async (req, res) => {
  try {
    // Delete existing content
    await HeroContent.deleteMany({});
    
    const newContent = await HeroContent.create(req.body);
    
    res.status(201).json({
      success: true,
      data: newContent
    });
  } catch (error) {
    console.error('Error creating hero content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create content' 
    });
  }
};








// Update hero content
export const updateHeroContent = async (req, res) => {
  try {
    const content = await HeroContent.findOne();
    
    if (!content) {
      return res.status(404).json({ 
        success: false,
        error: 'Content not found' 
      });
    }
    
    // Initialize arrays if they don't exist
    if (!content.cardImages) {
      content.cardImages = {
        frontImage: "",
        backImage: ""
      };
    }
    
    if (!content.galleryImages || !Array.isArray(content.galleryImages)) {
      content.galleryImages = Array(5).fill("");
    }
    
    // Update text fields
    const { heading, paragraph, ctaText, badgeText, galleryCaption } = req.body;
    
    if (heading !== undefined) content.heading = heading;
    if (paragraph !== undefined) content.paragraph = paragraph;
    if (ctaText !== undefined) content.ctaText = ctaText;
    if (badgeText !== undefined) content.badgeText = badgeText;
    if (galleryCaption !== undefined) content.galleryCaption = galleryCaption;
    
    // Also allow updating image URLs directly
    if (req.body.cardImages) {
      content.cardImages = {
        frontImage: req.body.cardImages.frontImage || content.cardImages.frontImage || "",
        backImage: req.body.cardImages.backImage || content.cardImages.backImage || ""
      };
    }
    
    if (req.body.galleryImages && Array.isArray(req.body.galleryImages)) {
      // Take only first 5 images and ensure array length is 5
      content.galleryImages = req.body.galleryImages.slice(0, 5);
      while (content.galleryImages.length < 5) {
        content.galleryImages.push("");
      }
    }
    
    await content.save();
    
    res.status(200).json({
      success: true,
      data: content,
      message: 'Content updated successfully'
    });
  } catch (error) {
    console.error('Error updating hero content:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to update content' 
    });
  }
};










// Upload images for hero content
export const uploadHeroImages = async (req, res) => {
  try {
    const files = req.files;
    
    console.log('Upload files received:', Object.keys(files || {}));
    console.log('File details:', {
      frontImage: files?.frontImage?.[0]?.originalname || 'none',
      backImage: files?.backImage?.[0]?.originalname || 'none',
      galleryImages: files?.galleryImages?.map(f => f.originalname) || []
    });
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files uploaded' 
      });
    }
    
    // Get or create hero content
    let content = await HeroContent.findOne();
    if (!content) {
      content = new HeroContent({
        heading: "Transform Your Ride with Expert Auto Care",
        paragraph: "Discover top-tier professionals for PPF, wraps, tinting, and ceramic coating. Compare bids, explore services, and elevate your vehicle's look with unmatched quality.",
        ctaText: "Get Your Free Bid",
        badgeText: "Premium Vehicle Transformation",
        galleryCaption: "Featured transformations from our network of professionals"
      });
    }
    
    // Initialize arrays if they don't exist
    if (!content.cardImages) {
      content.cardImages = {
        frontImage: "",
        backImage: ""
      };
    }
    
    if (!content.galleryImages || !Array.isArray(content.galleryImages)) {
      content.galleryImages = [];
    }
    
    // Map uploaded files to their fields
    const uploadedImages = {};
    
    // Handle card images
    if (files.frontImage && files.frontImage[0]) {
      uploadedImages.frontImage = files.frontImage[0].path;
      console.log('Uploaded front image URL:', uploadedImages.frontImage);
    }
    if (files.backImage && files.backImage[0]) {
      uploadedImages.backImage = files.backImage[0].path;
      console.log('Uploaded back image URL:', uploadedImages.backImage);
    }
    
    // Handle gallery images
    if (files.galleryImages && files.galleryImages.length > 0) {
      // Only take first 5 gallery images
      uploadedImages.galleryImages = files.galleryImages.slice(0, 5).map(file => file.path);
      console.log(`Uploaded ${uploadedImages.galleryImages.length} gallery images`);
    }
    
    // Update content with uploaded image URLs
    // For card images, replace if new file uploaded
    if (uploadedImages.frontImage) {
      content.cardImages.frontImage = uploadedImages.frontImage;
    }
    if (uploadedImages.backImage) {
      content.cardImages.backImage = uploadedImages.backImage;
    }
    
    // For gallery images: replace all gallery images with new uploads
    // OR merge with existing (choose one strategy)
    if (uploadedImages.galleryImages && uploadedImages.galleryImages.length > 0) {
      // Strategy 1: Replace all gallery images
      content.galleryImages = uploadedImages.galleryImages;
      
      // Strategy 2: Keep existing and add new (max 5 total)
      // const existingImages = content.galleryImages.filter(img => img && img.trim() !== "");
      // const allImages = [...existingImages, ...uploadedImages.galleryImages].slice(0, 5);
      // content.galleryImages = allImages;
    }
    
    // Ensure we always have exactly 5 gallery slots
    while (content.galleryImages.length < 5) {
      content.galleryImages.push("");
    }
    
    await content.save();
    
    console.log('Content saved successfully:', {
      frontImage: content.cardImages.frontImage ? 'Yes' : 'No',
      backImage: content.cardImages.backImage ? 'Yes' : 'No',
      galleryCount: content.galleryImages.filter(img => img && img.trim() !== "").length,
      galleryImages: content.galleryImages
    });
    
    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: content
    });
    
  } catch (error) {
    console.error('Error uploading hero images:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to upload images' 
    });
  }
};
























// Get features content
export const getFeaturesContent = async (req, res) => {
  try {
    let content = await FeaturesContent.findOne();
    
    if (!content) {
      // Create default content if none exists
      const defaultContent = await FeaturesContent.create({
        aboutUs: {
          paragraph: "Bid A Wrap is revolutionizing the way people find quality vehicle wrap and detailing services. Our platform connects vehicle owners with trusted professionals through transparency, competitive pricing, and verified credentials.",
          image: "/car-31.png"
        },
        locateShops: {
          paragraph: "Find verified wrap and detailing shops in your area with our advanced search tools. Browse comprehensive portfolios, read authentic reviews from real customers, and connect with local professionals who specialize in the exact services your vehicle needs.",
          image: "/car-11.jpg",
          whatYoullFind: [
            "Detailed shop profiles with portfolios and certifications",
            "Authentic customer reviews and ratings",
            "Specialty services including wraps, PPF, ceramic coating, and detailing",
            "Direct contact information and instant quote requests"
          ]
        },
        joinNetwork: {
          paragraph: "Are you a shop owner looking to grow your business? Join Bid A Wrap's network of trusted professionals and connect with customers actively seeking your services. Get quality leads and increase your bookings today.",
          image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80",
          partnershipBenefits: [
            "Access to pre-qualified customer leads",
            "Enhanced online visibility and shop profile",
            "Marketing support and promotional opportunities"
          ]
        },
        faq: {
          paragraph: "Got questions? Find comprehensive answers to commonly asked questions about how Bid A Wrap works, pricing structures, project timelines, quality standards, and more. We're here to guide you every step of the way on your vehicle transformation journey.",
          image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80",
          popularTopics: [
            "How it works",
            "Pricing guide",
            "Project timelines",
            "Quality standards",
            "Warranty info",
            "Payment options"
          ]
        }
      });
      
      return res.status(200).json({
        success: true,
        data: defaultContent
      });
    }
    
    // Ensure all arrays exist and have at least default values
    if (!content.locateShops.whatYoullFind || !Array.isArray(content.locateShops.whatYoullFind)) {
      content.locateShops.whatYoullFind = [
        "Detailed shop profiles with portfolios and certifications",
        "Authentic customer reviews and ratings",
        "Specialty services including wraps, PPF, ceramic coating, and detailing",
        "Direct contact information and instant quote requests"
      ];
    }
    
    if (!content.joinNetwork.partnershipBenefits || !Array.isArray(content.joinNetwork.partnershipBenefits)) {
      content.joinNetwork.partnershipBenefits = [
        "Access to pre-qualified customer leads",
        "Enhanced online visibility and shop profile",
        "Marketing support and promotional opportunities"
      ];
    }
    
    if (!content.faq.popularTopics || !Array.isArray(content.faq.popularTopics)) {
      content.faq.popularTopics = [
        "How it works",
        "Pricing guide",
        "Project timelines",
        "Quality standards",
        "Warranty info",
        "Payment options"
      ];
    }
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching features content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch content' 
    });
  }
};

// Create features content
export const createFeaturesContent = async (req, res) => {
  try {
    // Delete existing content
    await FeaturesContent.deleteMany({});
    
    const newContent = await FeaturesContent.create(req.body);
    
    res.status(201).json({
      success: true,
      data: newContent
    });
  } catch (error) {
    console.error('Error creating features content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create content' 
    });
  }
};

// Update features content
export const updateFeaturesContent = async (req, res) => {
  try {
    const content = await FeaturesContent.findOne();
    
    if (!content) {
      return res.status(404).json({ 
        success: false,
        error: 'Content not found' 
      });
    }
    
    // Update aboutUs
    if (req.body.aboutUs) {
      if (req.body.aboutUs.paragraph !== undefined) {
        content.aboutUs.paragraph = req.body.aboutUs.paragraph;
      }
      if (req.body.aboutUs.image !== undefined) {
        content.aboutUs.image = req.body.aboutUs.image;
      }
    }
    
    // Update locateShops
    if (req.body.locateShops) {
      if (req.body.locateShops.paragraph !== undefined) {
        content.locateShops.paragraph = req.body.locateShops.paragraph;
      }
      if (req.body.locateShops.image !== undefined) {
        content.locateShops.image = req.body.locateShops.image;
      }
      if (req.body.locateShops.whatYoullFind !== undefined && Array.isArray(req.body.locateShops.whatYoullFind)) {
        content.locateShops.whatYoullFind = req.body.locateShops.whatYoullFind;
      }
    }
    
    // Update joinNetwork
    if (req.body.joinNetwork) {
      if (req.body.joinNetwork.paragraph !== undefined) {
        content.joinNetwork.paragraph = req.body.joinNetwork.paragraph;
      }
      if (req.body.joinNetwork.image !== undefined) {
        content.joinNetwork.image = req.body.joinNetwork.image;
      }
      if (req.body.joinNetwork.partnershipBenefits !== undefined && Array.isArray(req.body.joinNetwork.partnershipBenefits)) {
        content.joinNetwork.partnershipBenefits = req.body.joinNetwork.partnershipBenefits;
      }
    }
    
    // Update faq
    if (req.body.faq) {
      if (req.body.faq.paragraph !== undefined) {
        content.faq.paragraph = req.body.faq.paragraph;
      }
      if (req.body.faq.image !== undefined) {
        content.faq.image = req.body.faq.image;
      }
      if (req.body.faq.popularTopics !== undefined && Array.isArray(req.body.faq.popularTopics)) {
        content.faq.popularTopics = req.body.faq.popularTopics;
      }
    }
    
    await content.save();
    
    res.status(200).json({
      success: true,
      data: content,
      message: 'Content updated successfully'
    });
  } catch (error) {
    console.error('Error updating features content:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to update content' 
    });
  }
};

// Upload images for features content
export const uploadFeaturesImages = async (req, res) => {
  try {
    const files = req.files;
    
    console.log('Upload files received for features:', Object.keys(files || {}));
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files uploaded' 
      });
    }
    
    // Get or create features content
    let content = await FeaturesContent.findOne();
    if (!content) {
      content = new FeaturesContent({
        aboutUs: {
          paragraph: "Bid A Wrap is revolutionizing the way people find quality vehicle wrap and detailing services. Our platform connects vehicle owners with trusted professionals through transparency, competitive pricing, and verified credentials.",
          image: "/car-31.png"
        },
        locateShops: {
          paragraph: "Find verified wrap and detailing shops in your area with our advanced search tools. Browse comprehensive portfolios, read authentic reviews from real customers, and connect with local professionals who specialize in the exact services your vehicle needs.",
          image: "/car-11.jpg",
          whatYoullFind: [
            "Detailed shop profiles with portfolios and certifications",
            "Authentic customer reviews and ratings",
            "Specialty services including wraps, PPF, ceramic coating, and detailing",
            "Direct contact information and instant quote requests"
          ]
        },
        joinNetwork: {
          paragraph: "Are you a shop owner looking to grow your business? Join Bid A Wrap's network of trusted professionals and connect with customers actively seeking your services. Get quality leads and increase your bookings today.",
          image: "https://images.unsplash.com/photo-1580273916550-e323be2ae537?w=800&q=80",
          partnershipBenefits: [
            "Access to pre-qualified customer leads",
            "Enhanced online visibility and shop profile",
            "Marketing support and promotional opportunities"
          ]
        },
        faq: {
          paragraph: "Got questions? Find comprehensive answers to commonly asked questions about how Bid A Wrap works, pricing structures, project timelines, quality standards, and more. We're here to guide you every step of the way on your vehicle transformation journey.",
          image: "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&q=80",
          popularTopics: [
            "How it works",
            "Pricing guide",
            "Project timelines",
            "Quality standards",
            "Warranty info",
            "Payment options"
          ]
        }
      });
    }
    
    // Map uploaded files to their fields
    const uploadedImages = {};
    
    // Handle aboutUs image
    if (files.aboutUsImage && files.aboutUsImage[0]) {
      uploadedImages.aboutUsImage = files.aboutUsImage[0].path;
      console.log('Uploaded aboutUs image URL:', uploadedImages.aboutUsImage);
    }
    
    // Handle locateShops image
    if (files.locateShopsImage && files.locateShopsImage[0]) {
      uploadedImages.locateShopsImage = files.locateShopsImage[0].path;
      console.log('Uploaded locateShops image URL:', uploadedImages.locateShopsImage);
    }
    
    // Handle joinNetwork image
    if (files.joinNetworkImage && files.joinNetworkImage[0]) {
      uploadedImages.joinNetworkImage = files.joinNetworkImage[0].path;
      console.log('Uploaded joinNetwork image URL:', uploadedImages.joinNetworkImage);
    }
    
    // Handle faq image
    if (files.faqImage && files.faqImage[0]) {
      uploadedImages.faqImage = files.faqImage[0].path;
      console.log('Uploaded faq image URL:', uploadedImages.faqImage);
    }
    
    // Update content with uploaded image URLs
    if (uploadedImages.aboutUsImage) {
      content.aboutUs.image = uploadedImages.aboutUsImage;
    }
    
    if (uploadedImages.locateShopsImage) {
      content.locateShops.image = uploadedImages.locateShopsImage;
    }
    
    if (uploadedImages.joinNetworkImage) {
      content.joinNetwork.image = uploadedImages.joinNetworkImage;
    }
    
    if (uploadedImages.faqImage) {
      content.faq.image = uploadedImages.faqImage;
    }
    
    await content.save();
    
    console.log('Features content saved successfully with updated images');
    
    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: content
    });
    
  } catch (error) {
    console.error('Error uploading features images:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to upload images' 
    });
  }
};














// Get about us content
export const getAboutUsContent = async (req, res) => {
  try {
    console.log('=== GET ABOUT US CONTENT START ===');
    
    let content = await AboutUsContent.findOne();
    console.log('Database content found:', !!content);
    
    if (!content) {
      console.log('No content found, creating default...');
      // Create default content if none exists
      const defaultContent = await AboutUsContent.create({
        heading: "About Bidawrap.com",
        paragraphs: [
          "Bidawrap.com was created with one goal: to bring fairness, transparency, and opportunity to the wrap industry. Founded by a group of industry-leading professionals each with over 25 years of experience in wraps, graphics, and signage our mission is to build a platform that truly serves both shops and customers.",
          "Unlike traditional lead-generation sites that take commissions and hide behind marketing claims, Bidawrap.com is a true marketplace built on honesty, ethics, and trust. Here, customers can post their wrap projects and receive competitive bids from verified professionals specializing in color change wraps, PPF, commercial graphics, and more.",
          "Every shop that joins our platform goes through a verification process to ensure quality, professionalism, and reliability. Shops can bid freely without commissions, while customers get real, transparent pricing and access to trusted experts. It's a win-win environment designed for the entire wrap community."
        ],
        whyWeDoSection: {
          title: "Because the Industry Deserves Better.",
          subtitle: "WHY WE DO WHAT WE DO",
          paragraphs: [
            "We've spent decades in the wrap and signage industry, and we've seen how much it's changed. Too many platforms today claim to support professionals but instead charge unnecessary fees, manipulate pricing, or prioritize profits over people. We built Bidawrap.com to change that.",
            "Our purpose is to create a fair, honest, and ethical space where real shops and real customers can connect without the middlemen. We believe that when good work meets good people, the entire industry grows stronger."
          ],
          highlightedText: "Bidawrap.com was built by the industry, for the industry to empower professionals, inspire trust, and make the process of getting wrapped simple, transparent, and rewarding for everyone involved."
        },
        values: [
          {
            title: "No Commissions",
            description: "Shops bid freely without hidden fees or commissions"
          },
          {
            title: "Verified Shops",
            description: "Every shop is verified for quality and professionalism"
          },
          {
            title: "Built by Experts",
            description: "Founded by professionals with 25+ years experience"
          },
          {
            title: "Transparent Pricing",
            description: "Real pricing from real professionals, no hidden costs"
          }
        ],
        galleryImages: {
          colorChangeWrap: "/car-27.png",
          paintProtectionFilm: "/car-30.png",
          commercialGraphics: "/car-29.png"
        },
        // ADD DEFAULT FLIP CARD IMAGES
        flipCardImages: {
          frontImage: "/default-black-car.jpg",
          backImage: "/default-yellow-car.jpg"
        },
        stats: {
          yearsExperience: "25+",
          commissionFees: "0%",
          verifiedShops: "100%"
        },
        cta: {
          title: "Ready to Experience the Difference?",
          description: "Join thousands of customers and shops who trust Bidawrap.com for their wrap needs.",
          getBidButton: "Get a Bid",
          joinShopButton: "Join as a Shop"
        }
      });
      
      console.log('Default content created:', defaultContent._id);
      
      return res.status(200).json({
        success: true,
        data: defaultContent
      });
    }
    
    console.log('Existing content ID:', content._id);
    console.log('Content heading:', content.heading);
    
    // Ensure all arrays exist and have at least default values
    if (!content.paragraphs || !Array.isArray(content.paragraphs)) {
      console.log('Fixing paragraphs array');
      content.paragraphs = [
        "Bidawrap.com was created with one goal: to bring fairness, transparency, and opportunity to the wrap industry. Founded by a group of industry-leading professionals each with over 25 years of experience in wraps, graphics, and signage our mission is to build a platform that truly serves both shops and customers.",
        "Unlike traditional lead-generation sites that take commissions and hide behind marketing claims, Bidawrap.com is a true marketplace built on honesty, ethics, and trust. Here, customers can post their wrap projects and receive competitive bids from verified professionals specializing in color change wraps, PPF, commercial graphics, and more.",
        "Every shop that joins our platform goes through a verification process to ensure quality, professionalism, and reliability. Shops can bid freely without commissions, while customers get real, transparent pricing and access to trusted experts. It's a win-win environment designed for the entire wrap community."
      ];
    }
    
    if (!content.whyWeDoSection || !content.whyWeDoSection.paragraphs || !Array.isArray(content.whyWeDoSection.paragraphs)) {
      console.log('Fixing whyWeDoSection');
      content.whyWeDoSection = {
        title: "Because the Industry Deserves Better.",
        subtitle: "WHY WE DO WHAT WE DO",
        paragraphs: [
          "We've spent decades in the wrap and signage industry, and we've seen how much it's changed. Too many platforms today claim to support professionals but instead charge unnecessary fees, manipulate pricing, or prioritize profits over people. We built Bidawrap.com to change that.",
          "Our purpose is to create a fair, honest, and ethical space where real shops and real customers can connect without the middlemen. We believe that when good work meets good people, the entire industry grows stronger."
        ],
        highlightedText: "Bidawrap.com was built by the industry, for the industry to empower professionals, inspire trust, and make the process of getting wrapped simple, transparent, and rewarding for everyone involved."
      };
    }
    
    if (!content.values || !Array.isArray(content.values) || content.values.length === 0) {
      console.log('Fixing values array');
      content.values = [
        {
          title: "No Commissions",
          description: "Shops bid freely without hidden fees or commissions"
        },
        {
          title: "Verified Shops",
          description: "Every shop is verified for quality and professionalism"
        },
        {
          title: "Built by Experts",
          description: "Founded by professionals with 25+ years experience"
        },
        {
          title: "Transparent Pricing",
          description: "Real pricing from real professionals, no hidden costs"
        }
      ];
    }
    
    if (!content.galleryImages) {
      console.log('Fixing galleryImages');
      content.galleryImages = {
        colorChangeWrap: "/car-27.png",
        paintProtectionFilm: "/car-30.png",
        commercialGraphics: "/car-29.png"
      };
    }
    
    // ADD FLIP CARD IMAGES VALIDATION
    if (!content.flipCardImages) {
      console.log('Fixing flipCardImages');
      content.flipCardImages = {
        frontImage: "/default-black-car.jpg",
        backImage: "/default-yellow-car.jpg"
      };
    }
    
    if (!content.stats) {
      console.log('Fixing stats');
      content.stats = {
        yearsExperience: "25+",
        commissionFees: "0%",
        verifiedShops: "100%"
      };
    }
    
    if (!content.cta) {
      console.log('Fixing cta');
      content.cta = {
        title: "Ready to Experience the Difference?",
        description: "Join thousands of customers and shops who trust Bidawrap.com for their wrap needs.",
        getBidButton: "Get a Bid",
        joinShopButton: "Join as a Shop"
      };
    }
    
    // Save any changes made
    await content.save();
    
    console.log('Sending response with content');
    console.log('=== GET ABOUT US CONTENT END ===');
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching about us content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch content' 
    });
  }
};

// Create about us content
export const createAboutUsContent = async (req, res) => {
  try {
    // Delete existing content
    await AboutUsContent.deleteMany({});
    
    const newContent = await AboutUsContent.create(req.body);
    
    res.status(201).json({
      success: true,
      data: newContent
    });
  } catch (error) {
    console.error('Error creating about us content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create content' 
    });
  }
};

// Update about us content
export const updateAboutUsContent = async (req, res) => {
  try {
    const content = await AboutUsContent.findOne();
    
    if (!content) {
      return res.status(404).json({ 
        success: false,
        error: 'Content not found' 
      });
    }
    
    // Update all fields if they exist in request body
    if (req.body.heading !== undefined) {
      content.heading = req.body.heading;
    }
    
    if (req.body.paragraphs !== undefined && Array.isArray(req.body.paragraphs)) {
      content.paragraphs = req.body.paragraphs;
    }
    
    if (req.body.whyWeDoSection !== undefined) {
      if (req.body.whyWeDoSection.title !== undefined) {
        content.whyWeDoSection.title = req.body.whyWeDoSection.title;
      }
      if (req.body.whyWeDoSection.subtitle !== undefined) {
        content.whyWeDoSection.subtitle = req.body.whyWeDoSection.subtitle;
      }
      if (req.body.whyWeDoSection.paragraphs !== undefined && Array.isArray(req.body.whyWeDoSection.paragraphs)) {
        content.whyWeDoSection.paragraphs = req.body.whyWeDoSection.paragraphs;
      }
      if (req.body.whyWeDoSection.highlightedText !== undefined) {
        content.whyWeDoSection.highlightedText = req.body.whyWeDoSection.highlightedText;
      }
    }
    
    if (req.body.values !== undefined && Array.isArray(req.body.values)) {
      content.values = req.body.values;
    }
    
    if (req.body.galleryImages !== undefined) {
      if (req.body.galleryImages.colorChangeWrap !== undefined) {
        content.galleryImages.colorChangeWrap = req.body.galleryImages.colorChangeWrap;
      }
      if (req.body.galleryImages.paintProtectionFilm !== undefined) {
        content.galleryImages.paintProtectionFilm = req.body.galleryImages.paintProtectionFilm;
      }
      if (req.body.galleryImages.commercialGraphics !== undefined) {
        content.galleryImages.commercialGraphics = req.body.galleryImages.commercialGraphics;
      }
    }
    
    // ADD FLIP CARD IMAGES UPDATE LOGIC
    if (req.body.flipCardImages !== undefined) {
      if (req.body.flipCardImages.frontImage !== undefined) {
        content.flipCardImages.frontImage = req.body.flipCardImages.frontImage;
      }
      if (req.body.flipCardImages.backImage !== undefined) {
        content.flipCardImages.backImage = req.body.flipCardImages.backImage;
      }
    }
    
    if (req.body.stats !== undefined) {
      if (req.body.stats.yearsExperience !== undefined) {
        content.stats.yearsExperience = req.body.stats.yearsExperience;
      }
      if (req.body.stats.commissionFees !== undefined) {
        content.stats.commissionFees = req.body.stats.commissionFees;
      }
      if (req.body.stats.verifiedShops !== undefined) {
        content.stats.verifiedShops = req.body.stats.verifiedShops;
      }
    }
    
    if (req.body.cta !== undefined) {
      if (req.body.cta.title !== undefined) {
        content.cta.title = req.body.cta.title;
      }
      if (req.body.cta.description !== undefined) {
        content.cta.description = req.body.cta.description;
      }
      if (req.body.cta.getBidButton !== undefined) {
        content.cta.getBidButton = req.body.cta.getBidButton;
      }
      if (req.body.cta.joinShopButton !== undefined) {
        content.cta.joinShopButton = req.body.cta.joinShopButton;
      }
    }
    
    await content.save();
    
    res.status(200).json({
      success: true,
      data: content,
      message: 'Content updated successfully'
    });
  } catch (error) {
    console.error('Error updating about us content:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to update content' 
    });
  }
};

// Upload images for about us content
export const uploadAboutUsImages = async (req, res) => {
  try {
    const files = req.files;
    
    console.log('Upload files received for about us:', Object.keys(files || {}));
    
    if (!files || Object.keys(files).length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'No files uploaded' 
      });
    }
    
    // Get or create about us content
    let content = await AboutUsContent.findOne();
    if (!content) {
      content = new AboutUsContent({
        heading: "About Bidawrap.com",
        paragraphs: [
          "Bidawrap.com was created with one goal: to bring fairness, transparency, and opportunity to the wrap industry. Founded by a group of industry-leading professionals each with over 25 years of experience in wraps, graphics, and signage our mission is to build a platform that truly serves both shops and customers.",
          "Unlike traditional lead-generation sites that take commissions and hide behind marketing claims, Bidawrap.com is a true marketplace built on honesty, ethics, and trust. Here, customers can post their wrap projects and receive competitive bids from verified professionals specializing in color change wraps, PPF, commercial graphics, and more.",
          "Every shop that joins our platform goes through a verification process to ensure quality, professionalism, and reliability. Shops can bid freely without commissions, while customers get real, transparent pricing and access to trusted experts. It's a win-win environment designed for the entire wrap community."
        ],
        whyWeDoSection: {
          title: "Because the Industry Deserves Better.",
          subtitle: "WHY WE DO WHAT WE DO",
          paragraphs: [
            "We've spent decades in the wrap and signage industry, and we've seen how much it's changed. Too many platforms today claim to support professionals but instead charge unnecessary fees, manipulate pricing, or prioritize profits over people. We built Bidawrap.com to change that.",
            "Our purpose is to create a fair, honest, and ethical space where real shops and real customers can connect without the middlemen. We believe that when good work meets good people, the entire industry grows stronger."
          ],
          highlightedText: "Bidawrap.com was built by the industry, for the industry to empower professionals, inspire trust, and make the process of getting wrapped simple, transparent, and rewarding for everyone involved."
        },
        values: [
          {
            title: "No Commissions",
            description: "Shops bid freely without hidden fees or commissions"
          },
          {
            title: "Verified Shops",
            description: "Every shop is verified for quality and professionalism"
          },
          {
            title: "Built by Experts",
            description: "Founded by professionals with 25+ years experience"
          },
          {
            title: "Transparent Pricing",
            description: "Real pricing from real professionals, no hidden costs"
          }
        ],
        galleryImages: {
          colorChangeWrap: "/car-27.png",
          paintProtectionFilm: "/car-30.png",
          commercialGraphics: "/car-29.png"
        },
        // ADD DEFAULT FLIP CARD IMAGES
        flipCardImages: {
          frontImage: "/default-black-car.jpg",
          backImage: "/default-yellow-car.jpg"
        },
        stats: {
          yearsExperience: "25+",
          commissionFees: "0%",
          verifiedShops: "100%"
        },
        cta: {
          title: "Ready to Experience the Difference?",
          description: "Join thousands of customers and shops who trust Bidawrap.com for their wrap needs.",
          getBidButton: "Get a Bid",
          joinShopButton: "Join as a Shop"
        }
      });
    }
    
    // Map uploaded files to their fields
    const uploadedImages = {};
    
    // Handle gallery images
    if (files.colorChangeWrap && files.colorChangeWrap[0]) {
      uploadedImages.colorChangeWrap = files.colorChangeWrap[0].path;
      console.log('Uploaded color change wrap image URL:', uploadedImages.colorChangeWrap);
    }
    
    if (files.paintProtectionFilm && files.paintProtectionFilm[0]) {
      uploadedImages.paintProtectionFilm = files.paintProtectionFilm[0].path;
      console.log('Uploaded paint protection film image URL:', uploadedImages.paintProtectionFilm);
    }
    
    if (files.commercialGraphics && files.commercialGraphics[0]) {
      uploadedImages.commercialGraphics = files.commercialGraphics[0].path;
      console.log('Uploaded commercial graphics image URL:', uploadedImages.commercialGraphics);
    }
    
    // ADD HANDLING FOR FLIP CARD IMAGES
    if (files.frontImage && files.frontImage[0]) {
      uploadedImages.frontImage = files.frontImage[0].path;
      console.log('Uploaded front flip card image URL:', uploadedImages.frontImage);
    }
    
    if (files.backImage && files.backImage[0]) {
      uploadedImages.backImage = files.backImage[0].path;
      console.log('Uploaded back flip card image URL:', uploadedImages.backImage);
    }
    
    // Update content with uploaded image URLs
    if (uploadedImages.colorChangeWrap) {
      content.galleryImages.colorChangeWrap = uploadedImages.colorChangeWrap;
    }
    
    if (uploadedImages.paintProtectionFilm) {
      content.galleryImages.paintProtectionFilm = uploadedImages.paintProtectionFilm;
    }
    
    if (uploadedImages.commercialGraphics) {
      content.galleryImages.commercialGraphics = uploadedImages.commercialGraphics;
    }
    
    // UPDATE FLIP CARD IMAGES
    if (uploadedImages.frontImage) {
      content.flipCardImages.frontImage = uploadedImages.frontImage;
    }
    
    if (uploadedImages.backImage) {
      content.flipCardImages.backImage = uploadedImages.backImage;
    }
    
    await content.save();
    
    console.log('About us content saved successfully with updated images');
    
    res.status(200).json({
      success: true,
      message: 'Images uploaded successfully',
      data: content
    });
    
  } catch (error) {
    console.error('Error uploading about us images:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to upload images' 
    });
  }
};






















// Get join network content
export const getJoinNetworkContent = async (req, res) => {
  try {
    let content = await JoinNetworkContent.findOne();
    
    if (!content) {
      // Create default content if none exists
      const defaultContent = await JoinNetworkContent.create({
        hero: {
          title: "Join Our Network",
          subtitle: "Grow Your Business with Quality Leads",
          description: "Connect with customers looking for wraps, PPF, tinting, and detailing services. No commissions. No hidden fees. Just honest connections.",
          image: ""
        },
        benefits: [
          {
            icon: "TrendingUp",
            title: "Quality Leads",
            description: "Receive bid requests from customers actively seeking your services. No more cold calls or paid ads."
          },
          {
            icon: "DollarSign",
            title: "Zero Commission",
            description: "Keep 100% of your earnings. No hidden fees, no commissions, no surprises. Just honest business."
          },
          {
            icon: "Star",
            title: "Build Reputation",
            description: "Showcase your work and earn reviews from satisfied customers. Build trust and credibility."
          },
          {
            icon: "BarChart3",
            title: "Easy Management",
            description: "Simple dashboard to manage bids, quotes, and customer communications all in one place."
          },
          {
            icon: "Shield",
            title: "Verified Badge",
            description: "Get verified and stand out from competitors. Show customers you're a trusted professional."
          },
          {
            icon: "Users",
            title: "Community Support",
            description: "Join a network of professionals. Share knowledge, tips, and grow together."
          }
        ],
        features: [
          "Direct customer communication",
          "Portfolio showcase",
          "Real-time notifications",
          "Mobile-friendly dashboard",
          "Analytics and insights",
          "Priority support"
        ],
        howItWorks: [
          {
            step: 1,
            title: "Sign Up",
            description: "Create your shop account and complete verification"
          },
          {
            step: 2,
            title: "Get Verified",
            description: "Our team reviews your shop to ensure quality standards"
          },
          {
            step: 3,
            title: "Receive Leads",
            description: "Get notified when customers need your services"
          },
          {
            step: 4,
            title: "Submit Bids",
            description: "Send competitive quotes and win more projects"
          }
        ],
        finalCta: {
          title: "Ready to Grow Your Business?",
          description: "Join professional shops already using Bid A Wrap to grow with purpose and connect with customers who value quality work.",
          ctaText: "Get Started - It's Free"
        }
      });
      
      return res.status(200).json({
        success: true,
        data: defaultContent
      });
    }
    
    // Ensure arrays have proper structure
    if (!content.benefits || !Array.isArray(content.benefits)) {
      content.benefits = [];
    }
    
    if (!content.features || !Array.isArray(content.features)) {
      content.features = [];
    }
    
    if (!content.howItWorks || !Array.isArray(content.howItWorks)) {
      content.howItWorks = [];
    }
    
    res.status(200).json({
      success: true,
      data: content
    });
  } catch (error) {
    console.error('Error fetching join network content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch content' 
    });
  }
};

// Create join network content
export const createJoinNetworkContent = async (req, res) => {
  try {
    // Delete existing content
    await JoinNetworkContent.deleteMany({});
    
    const newContent = await JoinNetworkContent.create(req.body);
    
    res.status(201).json({
      success: true,
      data: newContent,
      message: 'Join network content created successfully'
    });
  } catch (error) {
    console.error('Error creating join network content:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to create content' 
    });
  }
};

// Update join network content
export const updateJoinNetworkContent = async (req, res) => {
  try {
    const content = await JoinNetworkContent.findOne();
    
    if (!content) {
      return res.status(404).json({ 
        success: false,
        error: 'Content not found' 
      });
    }
    
    // Update hero section
    if (req.body.hero) {
      const { title, subtitle, description, image } = req.body.hero;
      
      if (title !== undefined) content.hero.title = title;
      if (subtitle !== undefined) content.hero.subtitle = subtitle;
      if (description !== undefined) content.hero.description = description;
      if (image !== undefined) content.hero.image = image;
    }
    
    // Update benefits
    if (req.body.benefits && Array.isArray(req.body.benefits)) {
      content.benefits = req.body.benefits.map(benefit => ({
        icon: benefit.icon || 'TrendingUp',
        title: benefit.title || '',
        description: benefit.description || ''
      })).slice(0, 10); // Limit to 10 benefits
    }
    
    // Update features
    if (req.body.features && Array.isArray(req.body.features)) {
      content.features = req.body.features.filter(feature => feature && feature.trim() !== '');
    }
    
    // Update howItWorks
    if (req.body.howItWorks && Array.isArray(req.body.howItWorks)) {
      // Sort by step number and keep only steps 1-10
      content.howItWorks = req.body.howItWorks
        .filter(step => step.step >= 1 && step.step <= 10)
        .sort((a, b) => a.step - b.step)
        .map(step => ({
          step: step.step,
          title: step.title || '',
          description: step.description || ''
        }));
    }
    
    // Update final CTA
    if (req.body.finalCta) {
      const { title, description, ctaText } = req.body.finalCta;
      
      if (title !== undefined) content.finalCta.title = title;
      if (description !== undefined) content.finalCta.description = description;
      if (ctaText !== undefined) content.finalCta.ctaText = ctaText;
    }
    
    await content.save();
    
    res.status(200).json({
      success: true,
      data: content,
      message: 'Content updated successfully'
    });
  } catch (error) {
    console.error('Error updating join network content:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to update content' 
    });
  }
};

// Upload hero image for join network
export const uploadJoinNetworkImage = async (req, res) => {
  try {
    const files = req.files;
    
    console.log('Upload join network files received:', Object.keys(files || {}));
    
    if (!files || !files.image || !files.image[0]) {
      return res.status(400).json({ 
        success: false,
        error: 'No image file uploaded' 
      });
    }
    
    // Get or create join network content
    let content = await JoinNetworkContent.findOne();
    if (!content) {
      content = await JoinNetworkContent.create({
        hero: {
          title: "Join Our Network",
          subtitle: "Grow Your Business with Quality Leads",
          description: "Connect with customers looking for wraps, PPF, tinting, and detailing services. No commissions. No hidden fees. Just honest connections.",
          image: files.image[0].path
        },
        benefits: [],
        features: [],
        howItWorks: [],
        finalCta: {
          title: "Ready to Grow Your Business?",
          description: "Join professional shops already using Bid A Wrap to grow with purpose and connect with customers who value quality work.",
          ctaText: "Get Started - It's Free"
        }
      });
      
      return res.status(200).json({
        success: true,
        message: 'Image uploaded and content created',
        data: content
      });
    }
    
    // Update hero image URL
    content.hero.image = files.image[0].path;
    await content.save();
    
    console.log('Join network image updated successfully:', content.hero.image);
    
    res.status(200).json({
      success: true,
      message: 'Image uploaded successfully',
      data: content
    });
    
  } catch (error) {
    console.error('Error uploading join network image:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Failed to upload image' 
    });
  }
};