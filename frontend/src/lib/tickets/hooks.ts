/**
 * React hooks for ticket management
 * Provides easy-to-use hooks for ticket operations in components
 */

"use client";

import { useState, useEffect } from "react";
import { Ticket } from "./types";
import { getTicketsForUser } from "./firestore";
import { useAuth } from "@/hooks/useAuth";

/**
 * Hook to fetch and manage user tickets
 *
 * @returns Object with tickets, loading state, error, and refresh function
 */
export function useUserTickets() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTickets = async () => {
    if (!user) {
      setTickets([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const fetchedTickets = await getTicketsForUser(user.uid);
      setTickets(fetchedTickets);
    } catch (err: any) {
      console.error("[useUserTickets] Error:", err);
      setError(err.message || "Kunne ikke hente billetter");
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch tickets on mount and when user changes
  useEffect(() => {
    fetchTickets();
  }, [user?.uid]);

  return {
    tickets,
    loading,
    error,
    refresh: fetchTickets,
  };
}

/**
 * Hook to manage ticket count
 *
 * @returns Object with ticket count and loading state
 */
export function useTicketCount() {
  const { tickets, loading } = useUserTickets();

  return {
    count: tickets.length,
    loading,
  };
}

/**
 * Hook to filter tickets by claim status
 *
 * @returns Object with active tickets and tickets with claims
 */
export function useTicketsByStatus() {
  const { tickets, loading, error, refresh } = useUserTickets();

  const activeTickets = tickets.filter((t) => !t.claimId);
  const ticketsWithClaims = tickets.filter((t) => t.claimId);

  return {
    activeTickets,
    ticketsWithClaims,
    allTickets: tickets,
    loading,
    error,
    refresh,
  };
}
