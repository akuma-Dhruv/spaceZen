import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useListHouseholds, useCreateHousehold, getListHouseholdsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface HouseholdContextType {
  householdId: number | null;
  setHouseholdId: (id: number | null) => void;
}

const HouseholdContext = createContext<HouseholdContextType | undefined>(undefined);

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [householdId, setHouseholdId] = useState<number | null>(null);
  const { data: households } = useListHouseholds();
  
  // Set default household if none selected and data is available
  useEffect(() => {
    if (!householdId && households && households.length > 0) {
      setHouseholdId(households[0].id);
    }
  }, [households, householdId]);

  return (
    <HouseholdContext.Provider value={{ householdId, setHouseholdId }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const context = useContext(HouseholdContext);
  if (context === undefined) {
    throw new Error("useHousehold must be used within a HouseholdProvider");
  }
  return context;
}
