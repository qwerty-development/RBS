import { GoogleGenerativeAI } from "@google/generative-ai";
import { supabase } from "@/config/supabase";

// System prompt with instructions for structured responses
const SYSTEM_PROMPT = `You are a specialized restaurant assistant for TableReserve, a restaurant reservation app. Your ONLY role is to:
1. Help users find restaurants based on their preferences
2. Provide information about restaurants including cuisine type, price range, and features
3. Answer questions about restaurant availability and booking policies
4. Be friendly and professional in your responses

You have access to restaurant data including:
- Restaurant names, descriptions, and cuisine types
- Price ranges (1-4)
- Features like outdoor seating, parking, and shisha availability
- Opening hours and booking policies
- Ratings and reviews

RESPONSE FORMAT INSTRUCTIONS:
When your response involves showing specific restaurants to the user, you MUST format your response as follows:

1. Start with your conversational text response
2. Then add "RESTAURANTS_TO_SHOW:" on a new line
3. Then list the restaurant IDs that should be displayed as cards, separated by commas
4. Example:
   "I found some great Italian restaurants for you!
   RESTAURANTS_TO_SHOW: restaurant-1,restaurant-2,restaurant-3"

IMPORTANT CONSTRAINTS:
- ONLY answer questions related to restaurants, dining, and reservations
- DO NOT provide code, programming solutions, or technical implementations
- DO NOT answer questions outside the scope of restaurant assistance
- If asked about non-restaurant topics, politely redirect to restaurant-related subjects
- Always base your responses on the available restaurant data
- When recommending restaurants, always use the "RESTAURANTS_TO_SHOW:" format
- Keep responses focused on helping users find and book restaurants`;

// Initialize the Google AI model
const genAI = new GoogleGenerativeAI("AIzaSyASVqSrq2zXKrl-dsMfuU9RxY49J0_JQk8");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Store chat history
let chatHistory: { role: "user" | "model"; parts: { text: string }[] }[] = [];

// Fetch restaurant data from Supabase
async function getRestaurants() {
  const { data, error } = await supabase.from("restaurants").select("*");
  if (error) {
    console.error("Error fetching restaurants:", error);
    return [];
  }
  console.log("RESTAURANTS: " + JSON.stringify(data));
  return data || [];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  restaurants?: any[]; // Restaurant objects to display as cards
}

export async function ourAgent(messages: ChatMessage[]): Promise<ChatMessage> {
  try {
    // Get restaurant data
    const restaurants = await getRestaurants();

    // Create a map for quick restaurant lookup by ID
    const restaurantMap = new Map();
    restaurants.forEach((restaurant) => {
      restaurantMap.set(restaurant.id, restaurant);
    });

    // Format restaurant data for context
    const restaurantContext = restaurants
      .map((restaurant) => {
        // Helper function to safely handle undefined/null values
        const safeValue = (value: any, defaultValue = "Not available") => {
          if (value === undefined || value === null) return defaultValue;
          return value;
        };

        // Helper function to safely join arrays
        const safeJoin = (
          arr: any[] | null | undefined,
          defaultValue = "None",
        ) => {
          if (!arr || !Array.isArray(arr) || arr.length === 0)
            return defaultValue;
          return arr.join(", ");
        };

        // Helper function to safely format time
        const safeTime = (time: string | null | undefined) => {
          if (!time) return "Not available";
          return time;
        };

        return `
Restaurant ID: ${restaurant.id}
Restaurant: ${safeValue(restaurant.name)}
Description: ${safeValue(restaurant.description)}
Address: ${safeValue(restaurant.address)}
Cuisine Type: ${safeValue(restaurant.cuisine_type)}
Price Range: ${safeValue(restaurant.price_range)} (1-4 scale)
Opening Hours: ${safeTime(restaurant.opening_time)} - ${safeTime(restaurant.closing_time)}
Booking Policy: ${safeValue(restaurant.booking_policy)}
Contact: ${safeValue(restaurant.phone_number)}
Rating: ${safeValue(restaurant.average_rating, "0")} (${safeValue(restaurant.total_reviews, "0")} reviews)
Features:
- Dietary Options: ${safeJoin(restaurant.dietary_options)}
- Ambiance Tags: ${safeJoin(restaurant.ambiance_tags)}
- Tags: ${safeJoin(restaurant.tags)}
- Parking: ${restaurant.parking_available ? "Available" : "Not available"}
- Outdoor Seating: ${restaurant.outdoor_seating ? "Available" : "Not available"}
- Shisha: ${restaurant.shisha_available ? "Available" : "Not available"}
Featured: ${restaurant.featured ? "Yes" : "No"}
`;
      })
      .join("\n");

    // Convert new messages to the format expected by the API
    const newMessages = messages.map((msg) => ({
      role: msg.role === "user" ? ("user" as const) : ("model" as const),
      parts: [{ text: msg.content }],
    }));

    // If this is the first message, add the system context as part of the user's message
    if (chatHistory.length === 0) {
      const firstMessage = newMessages[0];
      firstMessage.parts[0].text = `${SYSTEM_PROMPT}\n\nHere is the current restaurant data:\n${restaurantContext}\n\nUser question: ${firstMessage.parts[0].text}`;
    }

    // Add new messages to chat history
    chatHistory = [...chatHistory, ...newMessages];

    // Start a chat session with full history
    const chat = model.startChat({
      history: chatHistory,
      generationConfig: {
        temperature: 0,
      },
    });

    // Get the last user message
    const lastUserMessage = messages[messages.length - 1];

    // Send message and get response
    const result = await chat.sendMessage(lastUserMessage.content);
    const response = await result.response;
    const text = response.text();

    // Parse the response to extract restaurant IDs
    let responseText = text;
    let restaurantCards: any[] = [];

    if (text.includes("RESTAURANTS_TO_SHOW:")) {
      const parts = text.split("RESTAURANTS_TO_SHOW:");
      responseText = parts[0].trim();

      if (parts[1]) {
        const restaurantIds = parts[1]
          .trim()
          .split(",")
          .map((id) => id.trim());
        restaurantCards = restaurantIds
          .map((id) => restaurantMap.get(id))
          .filter((restaurant) => restaurant !== undefined);
      }
    }

    // Add the response to chat history
    chatHistory.push({
      role: "model",
      parts: [{ text }],
    });

    return {
      role: "assistant",
      content: responseText,
      restaurants: restaurantCards.length > 0 ? restaurantCards : undefined,
    };
  } catch (error) {
    console.error("Error in AI agent:", error);
    throw error;
  }
}

// Function to clear chat history
export function clearChatHistory() {
  chatHistory = [];
}
