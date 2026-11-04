// routes/chatbot.routes.js
const express = require("express");
const router = express.Router();
const { PrismaClient } = require("@prisma/client");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");

// Load environment variables
require("dotenv").config();

const prisma = new PrismaClient();

// ============== OPENROUTER AI CONFIGURATION ==============
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY?.trim();
const HAS_VALID_OPENROUTER_API_KEY =
  typeof OPENROUTER_API_KEY === "string" &&
  OPENROUTER_API_KEY.startsWith("sk-or-v1-");

// OpenRouter API endpoint (OpenAI-compatible)
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

// Optional: your site URL and name for OpenRouter rankings
// (not required, but recommended by OpenRouter)
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://alemayehplastic.com";
const SITE_NAME = "Dream More Affiliate Market";

// Free & fast models on OpenRouter (in priority order).
// These are auto-tried until one works.
const OPENROUTER_MODELS = [
  "openai/gpt-4o-mini",
  "anthropic/claude-3.5-haiku",
  "google/gemini-flash-1.5",
  "meta-llama/llama-3.1-8b-instruct:free",
  "mistralai/mistral-7b-instruct:free",
];

if (HAS_VALID_OPENROUTER_API_KEY) {
  console.log("🤖 Chatbot running with OpenRouter AI integration");
} else {
  console.warn(
    OPENROUTER_API_KEY
      ? "⚠️ OPENROUTER_API_KEY is invalid; chatbot is using rule-based responses. Configure a valid OpenRouter key to enable AI responses."
      : "⚠️ OPENROUTER_API_KEY is not configured; chatbot is using rule-based responses."
  );
}

// ============== OPTIONAL AUTH ==============
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && token !== "undefined" && token !== "null") {
        try {
          const parts = token.split(".");
          if (parts.length === 3) {
            const decoded = JSON.parse(
              Buffer.from(parts[1], "base64").toString()
            );
            req.userId = decoded.userId || decoded.id;
            req.userRole = decoded.role || "USER";
            req.userEmail = decoded.email;
          }
        } catch (e) {
          // ignore decode errors
        }
      }
    }

    if (!req.userId) {
      let defaultUser = await prisma.user.findFirst();
      if (!defaultUser) {
        defaultUser = await prisma.user.create({
          data: {
            name: "Guest User",
            email: "guest@alemayehplastic.com",
            password: "guest123",
            role: "USER",
          },
        });
        console.log("✅ Created default guest user");
      }
      req.userId = defaultUser.id;
      req.userRole = defaultUser.role || "USER";
      req.userEmail = defaultUser.email;
    }
    next();
  } catch (error) {
    console.error("Auth error:", error.message);
    try {
      const defaultUser = await prisma.user.findFirst();
      if (defaultUser) {
        req.userId = defaultUser.id;
        req.userRole = defaultUser.role || "USER";
        req.userEmail = defaultUser.email;
        next();
      } else {
        res.status(500).json({ success: false, error: "Server error" });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: "Server error" });
    }
  }
};

// ============== AI RESPONSE GENERATOR ==============
class ChatbotAI {
  constructor() {
    this.contexts = {};
    this.products = [];
    this.initialized = false;
    this.workingModel = null;
    this.modelTested = false;
  }

  getSystemPrompt() {
    return `You are Dream More Affiliate Market's AI assistant, a helpful digital marketplace chatbot.

**Your Role:**
- Help customers discover products and browse marketplace listings
- Provide accurate product information, pricing, and availability from the listings
- Assist with shopping questions and general inquiries
- Be friendly, professional, and knowledgeable

**About Dream More Affiliate Market:**
- A digital marketplace for discovering products and exploring listings
- Listings across the categories currently available in the store
- Mission: Make product discovery and online shopping easier
- Help shoppers find information and connect with support

**Response Guidelines:**
1. Be concise but informative (2-3 sentences max)
2. Use emojis naturally to make responses engaging
3. Suggest specific products when possible
4. If you don't know something, suggest alternative ways to help
5. Keep responses focused on marketplace listings and shopping support
6. All prices are in Ethiopian Birr (ETB)

**Available Products:**
${this.products
  .map(
    (p) =>
      `- ${p.name}: ${p.category?.name || p.category}, ETB ${p.price}/${p.unitOfMeasurement || "unit"}, ${p.stock} in stock`
  )
  .join("\n")}

**Contact Information:**
- Email: support@alemayehplastic.com
- Phone: +251 900 000 000
- Hours: Mon-Sat 8AM - 6PM EAT (East Africa Time)

Generate helpful, friendly, and accurate responses to user queries.`;
  }

  async initialize() {
    if (this.initialized) return;
    try {
      const products = await prisma.product.findMany({
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          category: {
            select: { id: true, name: true, slug: true },
          },
          stock: true,
          unitOfMeasurement: true,
          images: true,
          discountPrice: true,
          brand: true,
        },
        where: {
          stock: { gt: 0 },
        },
      });
      this.products = products;
      this.initialized = true;
      console.log("✅ Chatbot initialized with", products.length, "products");

      if (HAS_VALID_OPENROUTER_API_KEY && !this.modelTested) {
        await this.findWorkingModel();
      }
    } catch (error) {
      console.error("❌ Failed to initialize chatbot:", error);
    }
  }

  async findWorkingModel() {
    this.modelTested = true;
    if (!HAS_VALID_OPENROUTER_API_KEY) {
      return;
    }

    console.log("🔍 Testing OpenRouter API connection...");

    for (const model of OPENROUTER_MODELS) {
      try {
        console.log(`🔄 Testing model: ${model}`);
        const response = await axios.post(
          OPENROUTER_API_URL,
          {
            model: model,
            messages: [{ role: "user", content: "Hello" }],
            max_tokens: 5,
          },
          {
            headers: {
              Authorization: `Bearer ${OPENROUTER_API_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": SITE_URL,
              "X-Title": SITE_NAME,
            },
            timeout: 15000,
          }
        );

        if (response.status === 200 && response.data?.choices?.[0]) {
          this.workingModel = model;
          console.log(`✅ OpenRouter API working with model: ${model}`);
          return;
        }
      } catch (error) {
        const errMsg =
          error.response?.data?.error?.message || error.message;
        console.log(`❌ Model ${model} failed:`, errMsg);
      }
    }

    console.log(
      "⚠️ No working OpenRouter model found. Will use fallback responses."
    );
  }

  getContext(userId) {
    if (!this.contexts[userId]) {
      this.contexts[userId] = {
        history: [],
        currentOrder: null,
        lastInteraction: Date.now(),
        userName: "",
      };
    }
    return this.contexts[userId];
  }

  async generateResponse(message, userId, conversationId) {
    await this.initialize();

    const context = this.getContext(userId);

    if (!context.userName) {
      try {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true },
        });
        context.userName = user ? user.name : "Guest";
      } catch (e) {
        context.userName = "Guest";
      }
    }

    context.history.push({ role: "user", content: message });

    const response = await this.generateAIResponse(message, context);

    context.history.push({ role: "assistant", content: response });
    context.lastInteraction = Date.now();

    await this.saveChatHistory(userId, conversationId, message, response);

    return response;
  }

  async generateAIResponse(message, context) {
    if (!HAS_VALID_OPENROUTER_API_KEY) {
      const lowerMessage = message.toLowerCase().trim();
      return await this.processRuleBasedIntent(lowerMessage, context);
    }

    if (!this.workingModel) {
      await this.findWorkingModel();
      if (!this.workingModel) {
        console.warn(
          "⚠️ No working OpenRouter model found, using fallback responses"
        );
        const lowerMessage = message.toLowerCase().trim();
        return await this.processRuleBasedIntent(lowerMessage, context);
      }
    }

    try {
      const history = context.history.slice(-5);

      const messages = [
        { role: "system", content: this.getSystemPrompt() },
      ];

      history.forEach((msg) => {
        if (msg.role === "user") {
          messages.push({ role: "user", content: msg.content });
        } else {
          messages.push({ role: "assistant", content: msg.content });
        }
      });

      messages.push({ role: "user", content: message });

      const response = await axios.post(
        OPENROUTER_API_URL,
        {
          model: this.workingModel,
          messages: messages,
          temperature: 0.7,
          max_tokens: 300,
          top_p: 0.9,
          stream: false,
        },
        {
          headers: {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": SITE_URL,
            "X-Title": SITE_NAME,
          },
          timeout: 20000,
        }
      );

      const aiResponse = response.data?.choices?.[0]?.message?.content;
      if (!aiResponse) {
        throw new Error("Empty response from OpenRouter");
      }
      return aiResponse;
    } catch (error) {
      console.error(
        "❌ OpenRouter API Error:",
        error.response?.data || error.message
      );

      // If the model was rejected, try to find a new one
      if (
        error.response?.status === 400 ||
        error.response?.status === 404 ||
        error.response?.data?.error?.code === "model_not_found"
      ) {
        this.workingModel = null;
        await this.findWorkingModel();
      }

      if (error.response?.status === 401) {
        console.error(
          "⚠️ Invalid OpenRouter API key. Please check your .env file"
        );
        return "I apologize, but I'm having trouble connecting to my AI service. Please check the API configuration. 🤖";
      }

      if (error.response?.status === 429) {
        console.error("⚠️ Rate limit exceeded for OpenRouter API");
        return "I'm receiving too many requests right now. Please wait a moment and try again. ⏳";
      }

      if (error.response?.status === 402) {
        console.error("⚠️ OpenRouter credits exhausted");
        return "I'm temporarily unavailable due to API quota limits. Please try again later. ⏳";
      }

      console.log("⚠️ Falling back to rule-based responses");
      const lowerMessage = message.toLowerCase().trim();
      return await this.processRuleBasedIntent(lowerMessage, context);
    }
  }

  // ========== FALLBACK: RULE-BASED RESPONSES ==========
  async processRuleBasedIntent(message, context) {
    if (
      this.matchesPattern(message, [
        "hello",
        "hi",
        "hey",
        "good morning",
        "good afternoon",
        "good evening",
        "howdy",
        "selam",
        "hola",
      ])
    ) {
      return this.getGreetingResponse(context);
    }

    if (
      this.matchesPattern(message, [
        "search",
        "find",
        "looking for",
        "need",
        "want",
        "product",
        "item",
        "show",
        "get",
      ])
    ) {
      return await this.handleProductSearch(message, context);
    }

    if (
      this.matchesPattern(message, [
        "category",
        "categories",
        "types",
        "kind of",
        "sort",
        "browse",
      ])
    ) {
      return this.handleCategoryBrowse();
    }

    if (
      this.matchesPattern(message, [
        "details",
        "info",
        "information",
        "tell me about",
        "what is",
        "describe",
      ])
    ) {
      return await this.handleProductDetails(message);
    }

    if (
      this.matchesPattern(message, [
        "price",
        "cost",
        "how much",
        "expensive",
        "cheap",
        "pricing",
      ])
    ) {
      return await this.handlePriceInquiry(message);
    }

    if (
      this.matchesPattern(message, [
        "stock",
        "available",
        "in stock",
        "quantity",
        "availability",
      ])
    ) {
      return await this.handleStockInquiry(message);
    }

    if (
      this.matchesPattern(message, [
        "order",
        "buy",
        "purchase",
        "checkout",
        "cart",
        "shopping",
        "add to cart",
      ])
    ) {
      return this.handleOrderInquiry();
    }

    if (
      this.matchesPattern(message, [
        "login",
        "sign in",
        "log in",
        "signin",
        "register",
        "sign up",
      ])
    ) {
      return this.getLoginHelpResponse();
    }

    if (
      this.matchesPattern(message, [
        "help",
        "support",
        "assist",
        "guide",
        "how to",
        "what can you do",
      ])
    ) {
      return this.getHelpResponse();
    }

    if (
      this.matchesPattern(message, [
        "about",
        "company",
        "who are you",
      ])
    ) {
      return this.getAboutResponse();
    }

    if (
      this.matchesPattern(message, [
        "contact",
        "phone",
        "email",
        "reach",
        "call",
        "message",
        "support",
      ])
    ) {
      return this.getContactResponse();
    }

    if (
      this.matchesPattern(message, [
        "bye",
        "goodbye",
        "see you",
        "thank you",
        "thanks",
        "cya",
        "later",
      ])
    ) {
      return this.getFarewellResponse(context);
    }

    return this.getDefaultResponse();
  }

  matchesPattern(message, patterns) {
    return patterns.some((pattern) => message.includes(pattern));
  }

  // ========== RESPONSE GENERATORS ==========

  getGreetingResponse(context) {
    const hour = new Date().getHours();
    let greeting = "Good morning";
    if (hour >= 12 && hour < 17) greeting = "Good afternoon";
    if (hour >= 17) greeting = "Good evening";

    const name = context.userName || "Guest";
    const responses = [
      `${greeting}${name ? " " + name : ""}! 👋 Welcome to Dream More Affiliate Market. How can I help you discover products today?`,
      `Hello${name ? " " + name : ""}! 👋 I'm your Dream More assistant. Need help finding a product?`,
      `Hi there${name ? " " + name : ""}! 🛍️ Ready to explore the marketplace? Let me know what you need.`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  getLoginHelpResponse() {
    return (
      `🔐 **Login/Register Help**\n\n` +
      `To access all features of Dream More Affiliate Market:\n\n` +
      `1. Go to the login page (click "Sign In" in the navbar)\n` +
      `2. Enter your email and password\n` +
      `3. Click "Sign In"\n\n` +
      `📧 **Demo Credentials:**\n` +
      `Admin: admin@alemayehplastic.com / admin@123\n` +
      `User: user@alemayehplastic.com / user@123\n\n` +
      `Don't have an account? Click "Register" to create one! 🔑`
    );
  }

  async handleProductSearch(message, context) {
    const keywords = message
      .replace(
        /search|find|looking for|need|want|product|item|show|get/gi,
        ""
      )
      .trim();

    if (!keywords || keywords.length < 2) {
      return `What kind of product are you looking for? Browse the marketplace or tell me what you need and I can help search the available listings.`;
    }

    const searchResults = this.products.filter(
      (p) =>
        p.name.toLowerCase().includes(keywords.toLowerCase()) ||
        p.description.toLowerCase().includes(keywords.toLowerCase()) ||
        (p.category?.name || "")
          .toLowerCase()
          .includes(keywords.toLowerCase())
    );

    if (searchResults.length === 0) {
      return `I couldn't find any products matching "${keywords}". 🤔 Try a different search term or browse the marketplace categories.`;
    }

    if (searchResults.length > 5) {
      const topResults = searchResults.slice(0, 5);
      return `I found ${searchResults.length} products matching "${keywords}". Here are the top 5:\n\n${topResults
        .map(
          (p, i) =>
            `${i + 1}. **${p.name}** - ETB ${p.price} per ${p.unitOfMeasurement || "unit"} (${p.category?.name || ""})\n   ${p.description.substring(0, 80)}...`
        )
        .join("\n\n")}\n\nWould you like more details on any of these? 🔍`;
    }

    return `I found ${searchResults.length} product(s) matching "${keywords}":\n\n${searchResults
      .map(
        (p, i) =>
          `${i + 1}. **${p.name}**\n   Price: ETB ${p.price} per ${p.unitOfMeasurement || "unit"}\n   Category: ${p.category?.name || ""}\n   Stock: ${p.stock} units\n   ${p.description}`
      )
      .join("\n\n")}\n\nWould you like to know more about any specific product? 📦`;
  }

  handleCategoryBrowse() {
    const categories = [
      ...new Set(this.products.map((p) => p.category?.name || "Other")),
    ];

    if (categories.length === 0) {
      return "Browse the Dream More digital marketplace to explore the available product listings. 📋";
    }

    return `We offer products in these categories:\n\n${categories
      .map(
        (cat, i) =>
          `${i + 1}. **${cat}** - ${this.products.filter((p) => (p.category?.name || "Other") === cat).length} products available`
      )
      .join("\n")}\n\nWhich category interests you? I can show you specific products! 🔍`;
  }

  async handleProductDetails(message) {
    const keywords = message
      .replace(/details|info|information|tell me about|what is|describe/gi, "")
      .trim();

    if (!keywords) {
      return "Which product would you like to know more about? Please specify the name. 📝";
    }

    const product = this.products.find(
      (p) =>
        p.name.toLowerCase().includes(keywords.toLowerCase()) ||
        keywords.toLowerCase().includes(p.name.toLowerCase())
    );

    if (!product) {
      return `I couldn't find detailed information about "${keywords}". Could you try another product name? 🤔`;
    }

    return (
      `📦 **${product.name}**\n\n` +
      `📝 Description: ${product.description}\n` +
      `💰 Price: ETB ${product.price} per ${product.unitOfMeasurement || "unit"}\n` +
      `📂 Category: ${product.category?.name || ""}\n` +
      `📊 Stock: ${product.stock} units available\n` +
      `🆔 Product ID: ${product.id}\n\n` +
      `Would you like to place an order for this product? 🛒`
    );
  }

  async handlePriceInquiry(message) {
    const keywords = message
      .replace(/price|cost|how much|expensive|cheap|pricing/gi, "")
      .trim();

    if (!keywords) {
      return "Which product's price would you like to know? Please specify the product name. 💰";
    }

    const product = this.products.find(
      (p) =>
        p.name.toLowerCase().includes(keywords.toLowerCase()) ||
        keywords.toLowerCase().includes(p.name.toLowerCase())
    );

    if (!product) {
      return `I couldn't find pricing for "${keywords}". Could you specify which product you're interested in? 💰`;
    }

    return (
      `💰 **${product.name}**\n` +
      `Price: ETB ${product.price} per ${product.unitOfMeasurement || "unit"}\n` +
      `Bulk discounts available for large orders!\n\n` +
      `Would you like to place an order? 🛒`
    );
  }

  async handleStockInquiry(message) {
    const keywords = message
      .replace(/stock|available|in stock|quantity|availability/gi, "")
      .trim();

    if (!keywords) {
      return "Which product's availability would you like to check? 📊";
    }

    const product = this.products.find(
      (p) =>
        p.name.toLowerCase().includes(keywords.toLowerCase()) ||
        keywords.toLowerCase().includes(p.name.toLowerCase())
    );

    if (!product) {
      return `I couldn't find stock information for "${keywords}". Could you try another product? 📊`;
    }

    const status =
      product.stock > 50
        ? "✅ In stock"
        : product.stock > 10
        ? "⚠️ Limited stock"
        : "🔴 Low stock - Order soon!";

    return (
      `📊 **${product.name}**\n` +
      `Stock: ${product.stock} units\n` +
      `Status: ${status}\n\n` +
      (product.stock < 20
        ? `⚠️ Only ${product.stock} units left! Order now to avoid disappointment.`
        : "")
    );
  }

  handleOrderInquiry() {
    return (
      `To place an order, please:\n\n` +
      `1. Browse our products at /shop\n` +
      `2. Add items to your cart\n` +
      `3. Proceed to checkout\n\n` +
      `Would you like me to help you find specific products? 🛒`
    );
  }

  getHelpResponse() {
    return (
      `I can help you with:\n\n` +
      `🔍 **Product Search** - "Find a product"\n` +
      `💰 **Pricing** - "How much does this product cost?"\n` +
      `📊 **Availability** - "Is this item available?"\n` +
      `📂 **Categories** - "Show me available categories"\n` +
      `🛒 **Ordering** - "How to place an order?"\n` +
      `🔐 **Login** - "How to login"\n` +
      `📞 **Contact** - "Get customer support"\n\n` +
      `What would you like to know? 🤔`
    );
  }

  getAboutResponse() {
    return (
      `🛍️ **About Dream More Affiliate Market**\n\n` +
      `Dream More Affiliate Market is a digital marketplace where shoppers can discover products and explore listings online.\n\n` +
      `✨ **Our Promise**: A simple, helpful shopping experience\n` +
      `🔎 **Our Marketplace**: Product listings from a range of categories\n` +
      `👥 **Our Community**: Shoppers looking for quality and value\n\n` +
      `Find something you love with Dream More!`
    );
  }

  getContactResponse() {
    return (
      `📞 **Contact Dream More Affiliate Market**\n\n` +
      `📧 Email: support@alemayehplastic.com\n` +
      `📱 Phone: +251 900 000 000\n` +
      `🕐 Hours: Mon-Sat 8AM - 6PM EAT (East Africa Time)\n` +
      `📍 Location: Bahir Dar, Ethiopia\n\n` +
      `How can we assist you today? 🤝`
    );
  }

  getFarewellResponse(context) {
    const name = context.userName || "Guest";
    const responses = [
      `Thank you for chatting${name ? " " + name : ""}! 📦 Have a great day! Feel free to come back anytime.`,
      `Goodbye${name ? " " + name : ""}! 👋 If you have more questions, I'm always here to help.`,
      `Thanks for visiting Dream More Affiliate Market${name ? ", " + name : ""}! Hope to see you again soon!`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  getDefaultResponse() {
    const suggestions = [
      "I can help you find products, check prices, or assist with orders.",
      "Would you like to browse our products by category?",
      "I can help you search listings, check product details, or get shopping support.",
      "Need help with something specific? Just ask!",
    ];
    return `I'm not sure I understand. 🤔\n\n${suggestions[Math.floor(Math.random() * suggestions.length)]}\n\nTry asking about:\n• "Find a product"\n• "Show me available categories"\n• "How much does this product cost?"\n• "Help with shopping"`;
  }

  async saveChatHistory(userId, conversationId, userMessage, botResponse) {
    try {
      if (!userId) {
        console.warn("No userId provided, skipping chat history save");
        return;
      }

      const userExists = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!userExists) {
        console.warn(
          `User with ID ${userId} not found, skipping chat history save`
        );
        return;
      }

      await prisma.chatMessage.create({
        data: {
          userId: userId,
          conversationId: conversationId || uuidv4(),
          userMessage: userMessage,
          botResponse: botResponse,
          timestamp: new Date(),
        },
      });
      console.log("✅ Chat history saved successfully");
    } catch (error) {
      console.error("Error saving chat history:", error.message);
    }
  }
}

// Initialize AI
const chatbotAI = new ChatbotAI();
chatbotAI.initialize();

// ============== ROUTES ==============

/**
 * POST /api/chatbot/message
 */
router.post("/message", optionalAuth, async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    const response = await chatbotAI.generateResponse(
      message,
      req.userId,
      conversationId
    );

    res.json({
      success: true,
      data: {
        message: response,
        conversationId: conversationId || uuidv4(),
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Error processing message:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process message",
      message:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * GET /api/chatbot/history
 */
router.get("/history", optionalAuth, async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 50, offset = 0 } = req.query;

    if (!userId) {
      return res.json({
        success: true,
        data: {
          messages: [],
          pagination: { total: 0, limit: 0, offset: 0, hasMore: false },
        },
      });
    }

    const messages = await prisma.chatMessage.findMany({
      where: { userId: userId },
      orderBy: { timestamp: "desc" },
      take: parseInt(limit),
      skip: parseInt(offset),
    });

    const total = await prisma.chatMessage.count({
      where: { userId: userId },
    });

    res.json({
      success: true,
      data: {
        messages: messages.reverse(),
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: offset + limit < total,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch chat history",
    });
  }
});

/**
 * DELETE /api/chatbot/history
 */
router.delete("/history", optionalAuth, async (req, res) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.json({
        success: true,
        data: { message: "No history to clear" },
      });
    }

    await prisma.chatMessage.deleteMany({
      where: { userId: userId },
    });

    res.json({
      success: true,
      data: { message: "Chat history cleared successfully" },
    });
  } catch (error) {
    console.error("Error clearing chat history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear chat history",
    });
  }
});

/**
 * GET /api/chatbot/unread/count
 */
router.get("/unread/count", optionalAuth, async (req, res) => {
  try {
    res.json({ success: true, data: { unreadCount: 0 } });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, error: "Failed to fetch unread count" });
  }
});

/**
 * GET /api/chatbot/products
 */
router.get("/products", optionalAuth, async (req, res) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        category: {
          select: { id: true, name: true, slug: true },
        },
        stock: true,
        unitOfMeasurement: true,
        images: true,
        discountPrice: true,
        brand: true,
      },
      where: {
        stock: { gt: 0 },
      },
    });

    res.json({ success: true, data: products });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, error: "Failed to fetch products" });
  }
});

module.exports = router;