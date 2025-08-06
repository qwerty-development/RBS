import { useState, useCallback } from 'react';
import { AvailabilityService } from '@/lib/AvailabilityService';
import { useAuth } from '@/context/supabase-provider';
import { TimeRangeSearchParams, TimeRangeResult } from '@/components/booking/TimeRangeSelector';

export function useTimeRangeSearch() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();
  
  const searchTimeRange = useCallback(async (params: TimeRangeSearchParams): Promise<TimeRangeResult[]> => {
    setLoading(true);
    setError(null);
    
    try {
      const availabilityService = AvailabilityService.getInstance();
      
      const results = await availabilityService.searchTimeRange({
        restaurantId: '', // This will be set when calling the hook
        date: params.date,
        startTime: params.timeRange.startTime,
        endTime: params.timeRange.endTime,
        partySize: params.partySize,
        tableTypes: [], // Don't filter by table types in the backend
        userId: profile?.id,
      });
      
      return results.map(result => ({
        timeSlot: result.timeSlot,
        tables: result.tables,
        tableOptions: result.tableOptions,
        allTableTypes: result.tableOptions.flatMap(option => option.tableTypes) as any[], // Collect all available table types
        totalCapacity: result.totalCapacity,
        requiresCombination: result.requiresCombination,
      }));
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search time range';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);
  
  const createSearchFunction = useCallback((restaurantId: string) => {
    return async (params: TimeRangeSearchParams): Promise<TimeRangeResult[]> => {
      setLoading(true);
      setError(null);
      
      try {
        const availabilityService = AvailabilityService.getInstance();
        
        const results = await availabilityService.searchTimeRange({
          restaurantId,
          date: params.date,
          startTime: params.timeRange.startTime,
          endTime: params.timeRange.endTime,
          partySize: params.partySize,
          tableTypes: [], // Don't filter by table types in the backend
          userId: profile?.id,
        });
        
        return results.map(result => ({
          timeSlot: result.timeSlot,
          tables: result.tables,
          tableOptions: result.tableOptions,
          allTableTypes: Array.from(new Set(result.tableOptions.flatMap(option => option.tableTypes))) as any[], // Collect all unique table types
          totalCapacity: result.totalCapacity,
          requiresCombination: result.requiresCombination,
        }));
        
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to search time range';
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
      }
    };
  }, [profile?.id]);
  
  return {
    searchTimeRange,
    createSearchFunction,
    loading,
    error,
  };
}
