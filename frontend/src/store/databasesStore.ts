import { create } from 'zustand';
import { databasesApi } from '@/lib/api';
import { Database, DatabaseType } from '@/types';

interface DatabasesState {
  databases: Database[];
  currentDatabase: Database | null;
  connectionString: string | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchDatabases: (filters?: { projectId?: string; type?: DatabaseType }) => Promise<void>;
  fetchDatabase: (id: string) => Promise<void>;
  createDatabase: (data: {
    name: string;
    type: DatabaseType;
    projectId: string;
    username?: string;
    password?: string;
  }) => Promise<Database>;
  updateDatabase: (
    id: string,
    data: {
      password?: string;
    }
  ) => Promise<void>;
  deleteDatabase: (id: string) => Promise<void>;
  fetchConnectionString: (id: string) => Promise<string>;
}

export const useDatabasesStore = create<DatabasesState>((set, get) => ({
  databases: [],
  currentDatabase: null,
  connectionString: null,
  isLoading: false,
  error: null,

  fetchDatabases: async (filters) => {
    set({ isLoading: true, error: null });

    try {
      const response = await databasesApi.getAll(filters);
      const databases = response.data?.data || [];

      set({
        databases,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  fetchDatabase: async (id) => {
    set({ isLoading: true, error: null });

    try {
      const response = await databasesApi.getById(id);
      const database = response.data?.data || [];

      set({
        currentDatabase: database,
        isLoading: false,
      });
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
    }
  },

  createDatabase: async (data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await databasesApi.create(data);
      const database = response.data?.data || [];

      set((state) => ({
        databases: [database, ...state.databases],
        isLoading: false,
      }));

      return database;
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  updateDatabase: async (id, data) => {
    set({ isLoading: true, error: null });

    try {
      const response = await databasesApi.update(id, data);
      const updatedDatabase = response.data?.data || [];

      set((state) => ({
        databases: state.databases.map((db) =>
          db.id === id ? updatedDatabase : db
        ),
        currentDatabase:
          state.currentDatabase?.id === id
            ? updatedDatabase
            : state.currentDatabase,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  deleteDatabase: async (id) => {
    set({ isLoading: true, error: null });

    try {
      await databasesApi.delete(id);

      set((state) => ({
        databases: state.databases.filter((db) => db.id !== id),
        currentDatabase:
          state.currentDatabase?.id === id ? null : state.currentDatabase,
        isLoading: false,
      }));
    } catch (error: any) {
      set({
        error: error.message,
        isLoading: false,
      });
      throw error;
    }
  },

  fetchConnectionString: async (id) => {
    set({ error: null });

    try {
      const response = await databasesApi.getConnectionString(id);
      const connectionString = response.data.data.connectionString;

      set({
        connectionString,
      });

      return connectionString;
    } catch (error: any) {
      set({
        error: error.message,
      });
      throw error;
    }
  },
}));
