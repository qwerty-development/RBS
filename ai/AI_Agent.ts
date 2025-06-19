import { GoogleGenerativeAI } from '@google/generative-ai';
import { supabase } from "@/config/supabase";

// System prompt with instructions
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
-I need you also whenever you need to show a restaurant (1 or more) , just show them in the json format that was sent to you in the context , please return all the info you have in the json
-Send the json in the end and only whenever it is needed ,  the text for the response should be in the beginning while the json listing in the end
-Always before sending the json send a line containing "JSON:"

IMPORTANT CONSTRAINTS:
- ONLY answer questions related to restaurants, dining, and reservations
- DO NOT provide code, programming solutions, or technical implementations
- DO NOT answer questions outside the scope of restaurant assistance
- If asked about non-restaurant topics, politely redirect to restaurant-related subjects
- If asked for code or technical solutions, explain that you're a restaurant assistant and can't help with programming
- Always base your responses on the available restaurant data
- Keep responses focused on helping users find and book restaurants

Remember to maintain context of the conversation and refer back to previous messages when relevant.`;

// Initialize the Google AI model
const genAI = new GoogleGenerativeAI("AIzaSyASVqSrq2zXKrl-dsMfuU9RxY49J0_JQk8");
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-exp" });

// Store chat history
let chatHistory: { role: 'user' | 'model'; parts: { text: string }[] }[] = [];

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
  role: 'user' | 'assistant';
  content: string;
}

export async function ourAgent(
  messages: ChatMessage[]
): Promise<ChatMessage> {
  try {
    // Get restaurant data
    const restaurants = await getRestaurants();
    
    // Format restaurant data for context
    const restaurantContext = restaurants
      .map((restaurant) => {
        // Helper function to safely handle undefined/null values
        const safeValue = (value: any, defaultValue = 'Not available') => {
          if (value === undefined || value === null) return defaultValue;
          return value;
        };

        // Helper function to safely join arrays
        const safeJoin = (arr: any[] | null | undefined, defaultValue = 'None') => {
          if (!arr || !Array.isArray(arr) || arr.length === 0) return defaultValue;
          return arr.join(', ');
        };

        // Helper function to safely format time
        const safeTime = (time: string | null | undefined) => {
          if (!time) return 'Not available';
          return time;
        };

        // Helper function to safely format coordinates
        const safeCoordinates = (location: { coordinates: [number, number] } | null | undefined) => {
          if (!location?.coordinates) return 'Not available';
          return `[${location.coordinates[1]}, ${location.coordinates[0]}] (latitude, longitude)`;
        };

        return `
Restaurant: ${safeValue(restaurant.name)}
Description: ${safeValue(restaurant.description)}
Address: ${safeValue(restaurant.address)}
Cuisine Type: ${safeValue(restaurant.cuisine_type)}
Price Range: ${safeValue(restaurant.price_range)} (1-4 scale)
Opening Hours: ${safeTime(restaurant.opening_time)} - ${safeTime(restaurant.closing_time)}
Booking Policy: ${safeValue(restaurant.booking_policy)}
Contact: ${safeValue(restaurant.phone_number)}
WhatsApp: ${safeValue(restaurant.whatsapp_number)}
Instagram: ${safeValue(restaurant.instagram_handle)}
Website: ${safeValue(restaurant.website_url)}
Menu URL: ${safeValue(restaurant.menu_url)}
Rating: ${safeValue(restaurant.average_rating, '0')} (${safeValue(restaurant.total_reviews, '0')} reviews)
Features:
- Dietary Options: ${safeJoin(restaurant.dietary_options)}
- Ambiance Tags: ${safeJoin(restaurant.ambiance_tags)}
- Tags: ${safeJoin(restaurant.tags)}
- Parking: ${restaurant.parking_available ? 'Available' : 'Not available'}${restaurant.valet_parking ? ' (Valet available)' : ''}
- Outdoor Seating: ${restaurant.outdoor_seating ? 'Available' : 'Not available'}
- Shisha: ${restaurant.shisha_available ? 'Available' : 'Not available'}
- Live Music: ${restaurant.live_music_schedule ? 'Available' : 'Not available'}
- Happy Hour: ${restaurant.happy_hour_times ? `${safeTime(restaurant.happy_hour_times.start)} - ${safeTime(restaurant.happy_hour_times.end)}` : 'Not available'}
Booking Details:
- Booking Window: ${safeValue(restaurant.booking_window_days, '0')} days
- Cancellation Window: ${safeValue(restaurant.cancellation_window_hours, '0')} hours
- Table Turnover: ${safeValue(restaurant.table_turnover_minutes, '0')} minutes
Location: ${safeCoordinates(restaurant.location)}
Featured: ${restaurant.featured ? 'Yes' : 'No'}
Last Updated: ${safeValue(restaurant.updated_at)}
`;
      })
      .join("\n");
    console.log("CONTEXT: " +restaurantContext);

    // Convert new messages to the format expected by the API
    const newMessages = messages.map(msg => ({
      role: msg.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: msg.content }]
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

    // Add the response to chat history
    chatHistory.push({
      role: 'model',
      parts: [{ text }]
    });
    
    return {
      role: 'assistant',
      content: text
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
  