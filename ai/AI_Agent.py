from typing import TypedDict, Annotated, Sequence
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.tools import tool
import os
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode

load_dotenv()

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
- I need you also whenever you need to show a restaurant (1 or more), just show them in the json format that was sent to you in the context, please return all the info you have in the json
- Send the json in the end and only whenever it is needed, the text for the response should be in the beginning while the json listing in the end
- Always before sending the json send a line containing "JSON:"

IMPORTANT CONSTRAINTS:
- ONLY answer questions related to restaurants, dining, and reservations
- DO NOT provide code, programming solutions, or technical implementations
- DO NOT answer questions outside the scope of restaurant assistance
- If asked about non-restaurant topics, politely redirect to restaurant-related subjects
- If asked for code or technical solutions, explain that you're a restaurant assistant and can't help with programming
- Always base your responses on the available restaurant data
- Keep responses focused on helping users find and book restaurants

Remember to maintain context of the conversation and refer back to previous messages when relevant.
"""

# Initialize the model
model = ChatGoogleGenerativeAI(
    model="gemini-2.0-flash-exp", 
    api_key=os.getenv("GOOGLE_API_KEY"),
    temperature=0
)
model = model.bind_tools(tools)

def our_agent_node(state: AgentState) -> AgentState:
    """Our agent node that processes messages and generates responses."""
    messages = state["messages"]
    
    # Create the full prompt with system message and conversation history
    full_messages = [SystemMessage(content=system_prompt)] + list(messages)
    
    # Get response from the model
    response = model.invoke(full_messages)
    
    # Return the updated state with the new message
    return {"messages": [response]}

def should_continue(state: AgentState) -> str:
    """Determine whether to continue or end the conversation."""
    last_message = state["messages"][-1]
    
    # Since we don't have tools yet, we always end after agent response
    if isinstance(last_message, AIMessage):
        return END
    else:
        return "agent"

# Create the graph
graph = StateGraph(AgentState)

# Add nodes
graph.add_node("agent", our_agent_node)

# Add edges
graph.add_edge(START, "agent")
graph.add_edge("agent", END)

# Compile the graph
app = graph.compile()

def run_agent(user_input: str) -> str:
    """
    Function to run the agent with user input.
    This will be useful when integrating with Flask later.
    """
    # Create initial state with user message
    initial_state = {
        "messages": [HumanMessage(content=user_input)]
    }
    
    # Run the agent
    result = app.invoke(initial_state)
    
    # Extract the last AI message
    last_message = result["messages"][-1]
    if isinstance(last_message, AIMessage):
        return last_message.content
    else:
        return "Sorry, I couldn't process your request."

# Example usage for testing
if __name__ == "__main__":
    # Test the agent
    test_input = "Hello, I'm looking for Italian restaurants in the area."
    response = run_agent(test_input)
    print(f"User: {test_input}")
    print(f"Agent: {response}")
    
    # You can add more test cases here
    test_cases = [
        "What restaurants do you recommend for a romantic dinner?",
        "Do you have any restaurants with outdoor seating?",
        "Can you help me write Python code?",  # This should be redirected
    ]
    
    for test in test_cases:
        print(f"\nUser: {test}")
        response = run_agent(test)
        print(f"Agent: {response}")