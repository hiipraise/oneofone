// src/hooks/useData.js
import { useState, useEffect, useCallback } from "react";
import {
  getPredictions,
  getMetricsSummary,
  getMetrics,
  getResults,
} from "../services/api";

export function usePredictions(sport = null, limit = 50) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getPredictions(sport, limit);
      // API returns an array directly
      setData(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [sport, limit]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { data, loading, error, refetch: fetch };
}

export function useMetricsSummary() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMetricsSummary();
      setData(res.data ?? null);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);
  return { data, loading, error, refetch: fetch };
}

export function useMetricsHistory(limit = 30) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetrics(limit)
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading };
}

/**
 * Fetches resolved predictions (actual results joined with prediction data).
 * Used for calibration charts and accuracy tracking.
 */
export function useResults(limit = 50) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getResults(limit)
      .then((r) => setData(Array.isArray(r.data) ? r.data : []))
      .catch((e) => {
        console.warn("useResults fetch failed:", e.message);
        setError(e.message);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, [limit]);

  return { data, loading, error };
}
