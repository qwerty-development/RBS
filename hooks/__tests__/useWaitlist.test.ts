import { renderHook } from "@testing-library/react-native";
import { useWaitlist } from "../useWaitlist";
import { supabase } from "@/config/supabase";
import { useAuth } from "@/context/supabase-provider";

// Mock the dependencies
jest.mock("@/config/supabase", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock("@/context/supabase-provider", () => ({
  useAuth: jest.fn(),
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe("useWaitlist", () => {
  const mockUser = { id: "user-123" };
  const mockInsert = jest.fn();
  const mockSelect = jest.fn();
  const mockSingle = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({ user: mockUser });

    mockSingle.mockResolvedValue({
      data: { id: "waitlist-123", user_id: "user-123" },
      error: null,
    });
    mockSelect.mockReturnValue({ single: mockSingle });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSupabase.from.mockReturnValue({ insert: mockInsert } as any);
  });

  describe("joinWaitlist", () => {
    it("should correctly format time range with bracket notation", async () => {
      const { result } = renderHook(() => useWaitlist());

      const entry = {
        userId: "user-123",
        restaurantId: "restaurant-456",
        desiredDate: "2024-01-15",
        desiredTimeRange: "[14:30,16:00)",
        partySize: 2,
        table_type: "any" as const,
      };

      await result.current.joinWaitlist(entry);

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-123",
        restaurant_id: "restaurant-456",
        desired_date: "2024-01-15",
        desired_time_range:
          '["2024-01-15T14:30:00.000Z","2024-01-15T16:00:00.000Z")',
        party_size: 2,
        table_type: "any",
        status: "active",
      });
    });

    it("should correctly format time range with dash notation", async () => {
      const { result } = renderHook(() => useWaitlist());

      const entry = {
        userId: "user-123",
        restaurantId: "restaurant-456",
        desiredDate: "2024-01-15",
        desiredTimeRange: "14:30-16:00",
        partySize: 2,
        table_type: "booth" as const,
      };

      await result.current.joinWaitlist(entry);

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-123",
        restaurant_id: "restaurant-456",
        desired_date: "2024-01-15",
        desired_time_range:
          '["2024-01-15T14:30:00.000Z","2024-01-15T16:00:00.000Z")',
        party_size: 2,
        table_type: "booth",
        status: "active",
      });
    });

    it("should create 1-hour range for single time", async () => {
      const { result } = renderHook(() => useWaitlist());

      const entry = {
        userId: "user-123",
        restaurantId: "restaurant-456",
        desiredDate: "2024-01-15",
        desiredTimeRange: "14:30",
        partySize: 2,
        table_type: "window" as const,
      };

      await result.current.joinWaitlist(entry);

      expect(mockInsert).toHaveBeenCalledWith({
        user_id: "user-123",
        restaurant_id: "restaurant-456",
        desired_date: "2024-01-15",
        desired_time_range:
          '["2024-01-15T14:30:00.000Z","2024-01-15T15:30:00.000Z")',
        party_size: 2,
        table_type: "window",
        status: "active",
      });
    });

    it("should throw error when user is not authenticated", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => useWaitlist());

      const entry = {
        userId: "user-123",
        restaurantId: "restaurant-456",
        desiredDate: "2024-01-15",
        desiredTimeRange: "14:30",
        partySize: 2,
        table_type: "standard" as const,
      };

      await expect(result.current.joinWaitlist(entry)).rejects.toThrow(
        "Authentication required to join waitlist",
      );
    });
  });
});
