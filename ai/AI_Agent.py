from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
import os
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from supabase import create_client, Client
import json

load_dotenv()
url: str = os.environ.get("EXPO_PUBLIC_SUPABASE_URL")
key: str = os.environ.get("EXPO_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

class AgentState(TypedDict):
    """State of the agent."""
    messages: Annotated[Sequence[BaseMessage], add_messages]

tools = []

system_prompt = """
You are a specialized restaurant assistant for TableReserve, a restaurant reservation app. Your ONLY role is to:
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
- Keep responses focused on helping users find and book restaurants
- You are only allowed to use the tools provided to you for looking up restaurant data
- After using any tools to gather restaurant information, call the finishedUsingTools tool to signal completion
- If you can answer without using tools (like general questions about the service), you can respond directly without calling finishedUsingTools
- Make sure to show first the restaurants id of the ones that has the ai_featured column set to true , this way they would be shown first to the user and then show the others
"""
restaurants_table_columns:str = "id, name, description, address, tags, cuisine_type, price_range, average_rating, dietary_options, ambiance_tags, outdoor_seating, ai_featured"
@tool
def finishedUsingTools() -> str:
    """Call this when you're done using tools and ready to respond."""
    print("AI finished using tools")
    return "Tools usage completed. Ready to provide response."

tools.append(finishedUsingTools)

@tool
def getAllCuisineTypes() -> str:
    """Return the unique cuisine types available in the application"""
    print("AI is looking for cuisine types")
    try:
        result = supabase.table("restaurants").select("cuisine_type").execute()
        cuisineTypes = result.data
        
        if not cuisineTypes:
            return "Currently we have no cuisine types available"
        
        # Extract unique cuisine types
        unique_cuisines = list(set([item['cuisine_type'] for item in cuisineTypes if item.get('cuisine_type')]))
        print(f"Found cuisine types: {unique_cuisines}")
        return json.dumps(unique_cuisines)
    except Exception as e:
        print(f"Error fetching cuisine types: {e}")
        return "Error retrieving cuisine types"

tools.append(getAllCuisineTypes)

@tool
def getRestaurantsByCuisineType(cuisineType: str) -> str:
    """Request restaurants from the database based on the cuisine type"""
    cuisineType=cuisineType.strip().capitalize()
    print(f"AI is looking for restaurants with cuisine type: {cuisineType}")
    try:
        # Use ilike for case-insensitive matching in PostgreSQL/Supabase
        result = supabase.table("restaurants").select(restaurants_table_columns).ilike("cuisine_type", cuisineType).execute()
        restaurants = result.data
        
        if not restaurants:
            return f"No restaurants found with cuisine type: {cuisineType}"
        
        print(f"Found {len(restaurants)} restaurants")
        return json.dumps(restaurants)
    except Exception as e:
        print(f"Error fetching restaurants: {e}")
        return f"Error retrieving restaurants for cuisine type: {cuisineType}"

tools.append(getRestaurantsByCuisineType)

@tool
def getAllRestaurants() -> str:
    """Request all restaurants with all their info from the database"""
    print("AI is looking for all restaurants")
    try:
        result = supabase.table("restaurants").select(restaurants_table_columns).execute()
        restaurants = result.data

        if not restaurants:
            return "No restaurants found"
        print("the restaurants found are: "+str(restaurants))
        return json.dumps(restaurants)
    
    except Exception as e:
        print(f"Error fetching restaurants: {e}")
        return "Error retrieving restaurants"

tools.append(getAllRestaurants)

# Initialize the model
llm = ChatGoogleGenerativeAI(
    model="gemini-2.5-flash-lite-preview-06-17", 
    api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)
llm = llm.bind_tools(tools)

def agent_node(state: AgentState) -> AgentState:
    """Our agent node that processes messages and generates responses."""
    messages = state["messages"]
    
    # Create the full prompt with system message and conversation
    full_messages = [SystemMessage(content=system_prompt)] + messages
    
    print(f"Sending {len(full_messages)} messages to LLM")
    
    # Get response from the model
    response = llm.invoke(full_messages)
    
    # print(f"LLM response type: {type(response)}")
    # print(f"LLM response content: {response.content}")
    # print(f"LLM tool calls: {response.tool_calls}")
    
    # Return the updated state with the new message
    return {"messages": [response]}

def should_continue(state: AgentState) -> str:
    """Determine whether to continue with tools or end the conversation"""
    last_message = state["messages"][-1]

    
    if isinstance(last_message, AIMessage):
        tool_calls = getattr(last_message, 'tool_calls', []) or []
        print(f"Tool calls found: {len(tool_calls)}")
        
        # If there are tool calls, check if finishedUsingTools was called
        for call in tool_calls:
            print(f"Tool call: {call}")
            if call["name"] == "finishedUsingTools":
                print("✅ AI called finishedUsingTools tool - ending")
                return "end"
        
        # If there are other tool calls, continue to tools
        if tool_calls:
            print("🔧 AI has tool calls - continuing to tools")
            return "continue"
        
        # If no tool calls and has content, end
        if last_message.content:
            print("💬 AI has content but no tool calls - ending")
            return "end"
    
    print("🔄 Default case - continuing")
    return "continue"

# Create the graph
graph = StateGraph(AgentState)

# Add nodes
graph.add_node("agent", agent_node)
graph.add_node("tools", ToolNode(tools))

# Add edges
graph.add_edge(START, "agent")
graph.add_conditional_edges(
    "agent",
    should_continue,
    {
        "continue": "tools",
        "end": END
    }
)
graph.add_edge("tools", "agent")

# Compile the graph
app = graph.compile()

# Global variable to maintain chat state
chat_state = {"messages": []}

def chat_with_bot(user_input: str) -> str:
    """
    Function to chat with the bot while maintaining conversation history.
    The state automatically handles message history through add_messages.
    """
    global chat_state
    
    try:
        # Add the new user message and run the agent
        # The add_messages function in AgentState will handle appending to existing messages
        current_input = {"messages": [HumanMessage(content=user_input)]}
        
        # If we have existing chat state, merge with new input
        if chat_state["messages"]:
            result = app.invoke({**chat_state, **current_input})
        else:
            result = app.invoke(current_input)
        
        # Update the chat state with the complete result
        chat_state = result
        
        # Extract the last AI message
        ai_messages = [msg for msg in result["messages"] if isinstance(msg, AIMessage)]
        
        if ai_messages:
            last_ai_message = ai_messages[-1]
            return last_ai_message.content or "I apologize, but I couldn't generate a proper response. Please try again."
        else:
            print("No AI messages found in result")
            return "Sorry, I couldn't process your request."
            
    except Exception as e:
        print(f"Error running agent: {e}")
        return f"Sorry, I encountered an error: {str(e)}"

def reset_chat():
    """Reset the chat history to start a new conversation."""
    global chat_state
    chat_state = {"messages": []}
    print("Chat history has been reset.")

def get_chat_history():
    """Get the current chat history for debugging purposes."""
    global chat_state
    return chat_state["messages"]

# Interactive chat function for testing
def start_interactive_chat():
    """Start an interactive chat session."""
    print("🍽️ Welcome to TableReserve Restaurant Assistant!")
    print("Type 'quit' to exit, 'reset' to clear chat history, or 'history' to see conversation history.")
    print("-" * 50)
    
    while True:
        user_input = input("\nYou: ").strip()
        
        if user_input.lower() == 'quit':
            print("Thanks for using TableReserve! Goodbye! 👋")
            break
        elif user_input.lower() == 'reset':
            reset_chat()
            print("Chat history cleared. Starting fresh!")
            continue
        elif user_input.lower() == 'history':
            history = get_chat_history()
            print(f"\n📝 Chat History ({len(history)} messages):")
            for i, msg in enumerate(history):
                msg_type = "User" if isinstance(msg, HumanMessage) else "Bot"
                print(f"{i+1}. {msg_type}: {msg.content}")
            continue
        elif not user_input:
            print("Please enter a message.")
            continue
        
        print("Bot: ", end="", flush=True)
        response = chat_with_bot(user_input)
        print(response)

# Example usage for testing
if __name__ == "__main__":
    start_interactive_chat()