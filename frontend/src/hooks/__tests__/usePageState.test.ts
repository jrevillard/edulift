import { describe, it, expect } from 'vitest';
import { usePageState } from '../usePageState';

describe('usePageState', () => {
  it('should return correct state for loading', () => {
    const query = {
      data: undefined,
      isLoading: true,
      error: null
    };

    const result = usePageState(query);

    expect(result).toEqual({
      data: [],
      isLoading: true,
      error: null,
      isEmpty: true,
      shouldShowLoading: true,
      shouldShowError: false,
      shouldShowEmpty: false,
    });
  });

  it('should return correct state for error', () => {
    const error = new Error('Test error');
    const query = {
      data: undefined,
      isLoading: false,
      error
    };

    const result = usePageState(query);

    expect(result).toEqual({
      data: [],
      isLoading: false,
      error,
      isEmpty: true,
      shouldShowLoading: false,
      shouldShowError: true,
      shouldShowEmpty: false,
    });
  });

  it('should return correct state for empty data', () => {
    const query = {
      data: [],
      isLoading: false,
      error: null
    };

    const result = usePageState(query);

    expect(result).toEqual({
      data: [],
      isLoading: false,
      error: null,
      isEmpty: true,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: true,
    });
  });

  it('should return correct state for data with content', () => {
    const data = [{ id: 1, name: 'Test' }];
    const query = {
      data,
      isLoading: false,
      error: null
    };

    const result = usePageState(query);

    expect(result).toEqual({
      data,
      isLoading: false,
      error: null,
      isEmpty: false,
      shouldShowLoading: false,
      shouldShowError: false,
      shouldShowEmpty: false,
    });
  });

  it('should handle undefined data gracefully', () => {
    const query = {
      data: undefined,
      isLoading: false,
      error: null
    };

    const result = usePageState(query);

    expect(result.data).toEqual([]);
    expect(result.isEmpty).toBe(true);
    expect(result.shouldShowEmpty).toBe(true);
  });
});