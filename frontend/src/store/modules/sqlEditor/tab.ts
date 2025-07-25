import type { MaybeRef } from "@vueuse/core";
import { watchThrottled } from "@vueuse/core";
import { head, omit, pick } from "lodash-es";
import { defineStore, storeToRefs } from "pinia";
import { computed, nextTick, reactive, ref, unref, watch } from "vue";
import type {
  SQLEditorConnection,
  CoreSQLEditorTab,
  SQLEditorTab,
  SQLEditorDatabaseQueryContext,
  BatchQueryContext,
} from "@/types";
import { DEFAULT_SQL_EDITOR_TAB_MODE, isValidDatabaseName } from "@/types";
import { DataSourceType } from "@/types/proto-es/v1/instance_service_pb";
import { PlanFeature } from "@/types/proto-es/v1/subscription_service_pb";
import {
  WebStorageHelper,
  defaultSQLEditorTab,
  emptySQLEditorConnection,
  isDisconnectedSQLEditorTab,
  isSimilarSQLEditorTab,
  useDynamicLocalStorage,
} from "@/utils";
import {
  useDatabaseV1Store,
  useDatabaseV1ByName,
  useEnvironmentV1Store,
  extractUserId,
  hasFeature,
} from "../v1";
import { useCurrentUserV1 } from "../v1/auth";
import { useSQLEditorStore } from "./editor";
import {
  EXTENDED_TAB_FIELDS,
  useExtendedTabStore,
  type ExtendedTab,
} from "./extendedTab";
import { useTabViewStateStore } from "./tabViewState";
import { useWebTerminalStore } from "./webTerminal";

const LOCAL_STORAGE_KEY_PREFIX = "bb.sql-editor-tab";

// Only store the core fields of a tab.
// Don't store anything which might be too large.
const PERSISTENT_TAB_FIELDS = [
  "id",
  "title",
  "connection",
  "mode",
  "worksheet",
  "status",
] as const;
type PersistentTab = Pick<SQLEditorTab, (typeof PERSISTENT_TAB_FIELDS)[number]>;

// `tabsById` stores all PersistentTab items across all projects
const tabsById = reactive(new Map<string, SQLEditorTab>());

export const useSQLEditorTabStore = defineStore("sqlEditorTab", () => {
  // re-expose selected project in sqlEditorStore for shortcut
  const { project } = storeToRefs(useSQLEditorStore());

  // states
  const { fetchExtendedTab, saveExtendedTab, deleteExtendedTab } =
    useExtendedTabStore();
  const tabViewStateStore = useTabViewStateStore();

  const me = useCurrentUserV1();
  const userUID = computed(() => extractUserId(me.value.name));
  const keyNamespace = computed(
    () => `${LOCAL_STORAGE_KEY_PREFIX}.${userUID.value}`
  );
  const getStorage = () => {
    return new WebStorageHelper(keyNamespace.value);
  };
  const keyForTab = (id: string) => {
    return `tab.${id}`;
  };

  const loadStoredTab = (id: string) => {
    const stored = getStorage().load<PersistentTab | undefined>(
      keyForTab(id),
      undefined
    );
    if (!stored) {
      return undefined;
    }
    const tab = reactive<SQLEditorTab>({
      ...defaultSQLEditorTab(),
      // Ignore extended fields stored in localStorage since they are migrated
      // to extendedTabStore.
      ...omit(stored, EXTENDED_TAB_FIELDS),
      id,
    });
    if (tab.mode !== DEFAULT_SQL_EDITOR_TAB_MODE) {
      // Do not enter ADMIN mode initially
      tab.mode = DEFAULT_SQL_EDITOR_TAB_MODE;
    }

    fetchExtendedTab(tab, () => {
      // When the first time of migration, the extended doc in IndexedDB is not
      // found.
      // Fallback to the original PersistentTab in LocalStorage if possible.
      // This might happen only once to each user, since the second time when a
      // tab is saved, extended fields will be migrated, and won't be saved to
      // LocalStorage, so the fallback routine won't be hit.
      const { statement } = stored as any;
      if (statement) {
        tab.statement = statement;
      }
    });

    watchTab(tab, false /* !immediate */);
    tabsById.set(id, tab);
    return tab;
  };

  const tabIdListKey = computed(() => `${keyNamespace.value}.tab-id-list`);
  const tabIdListMapByProject = useDynamicLocalStorage<
    Record<string, string[]>
  >(tabIdListKey, {});

  const currentTabIdKey = computed(
    () => `${keyNamespace.value}.current-tab-id`
  );
  const currentTabIdMapByProject = useDynamicLocalStorage<
    Record<string, string | undefined>
  >(currentTabIdKey, {}, localStorage, {
    listenToStorageChanges: false,
  });

  const initializedProjects = new Set<string>();
  const maybeInitProject = (project: string) => {
    if (!project) {
      return;
    }
    if (initializedProjects.has(project)) {
      return;
    }

    const storedTabIdList = tabIdListMapByProject.value[project] ?? [];
    // Load tabs
    const validTabIdList: string[] = [];
    storedTabIdList.forEach((id) => {
      const stored = loadStoredTab(id);
      if (!stored) return;
      validTabIdList.push(id);
    });

    tabIdListMapByProject.value[project] = validTabIdList;

    // Load currentTabId
    const storedCurrentTabId = currentTabIdMapByProject.value[project];
    if (!storedCurrentTabId || !validTabIdList.includes(storedCurrentTabId)) {
      // storedCurrentTabId is not in tabIdList
      // fallback to the first tab or nothing
      currentTabIdMapByProject.value[project] = head(validTabIdList) ?? "";
    }

    initializedProjects.add(project);
  };

  // computed states
  // `tabIdList` is the tabIdList in current project
  // it's a combination of `project` and `tabIdListMapByProject`
  const tabIdList = computed({
    get() {
      // _maybeInitProject(project.value);
      return tabIdListMapByProject.value[project.value] ?? [];
    },
    set(list) {
      tabIdListMapByProject.value[project.value] = list;
    },
  });
  // `currentTabId` is the currentTabId in current project
  // it's a combination of `project` and `currentTabIdMapByProject`
  const currentTabId = computed({
    get() {
      // _maybeInitProject(project.value);
      return currentTabIdMapByProject.value[project.value] ?? "";
    },
    set(id) {
      currentTabIdMapByProject.value[project.value] = id;
    },
  });
  const tabById = (id: string) => {
    const existed = tabsById.get(id);
    if (existed) {
      return existed;
    }
    const stored = loadStoredTab(id);
    return stored;
  };
  const tabList = computed(() => {
    return tabIdList.value.map((id) => {
      return tabById(id) ?? defaultSQLEditorTab();
    });
  });
  const currentTab = computed(() => {
    const currId = currentTabId.value;
    if (!currId) return undefined;
    return tabById(currId);
  });

  const isInBatchMode = computed(() => {
    if (!currentTab.value) {
      return false;
    }
    if (!hasFeature(PlanFeature.FEATURE_BATCH_QUERY)) {
      return false;
    }
    const { batchQueryContext } = currentTab.value;
    if (!batchQueryContext) {
      return false;
    }
    const { databaseGroups = [], databases = [] } = batchQueryContext;
    if (!hasFeature(PlanFeature.FEATURE_DATABASE_GROUPS)) {
      return databases.length > 1;
    }
    return databaseGroups.length > 0 || databases.length > 1;
  });

  // actions
  /**
   *
   * @param payload
   * @param beside `true` to add the tab beside currentTab, `false` to add the tab to the last, default to `false`
   * @returns
   */
  const addTab = (payload?: Partial<SQLEditorTab>, beside = false) => {
    const newTab = reactive<SQLEditorTab>({
      ...defaultSQLEditorTab(),
      ...payload,
    });
    watchTab(newTab, true /* immediate */);

    const { id } = newTab;
    const position = tabIdList.value.indexOf(currentTabId.value ?? "");
    if (beside && position >= 0) {
      tabIdList.value.splice(position + 1, 0, id);
    } else {
      tabIdList.value.push(id);
    }
    currentTabId.value = id;
    tabsById.set(id, newTab);

    return newTab;
  };
  const removeTab = (tab: SQLEditorTab) => {
    const { id } = tab;
    const position = tabIdList.value.indexOf(id);
    if (position < 0) return;
    tabIdList.value.splice(position, 1);
    tabsById.delete(id);
    getStorage().remove(keyForTab(id));
    deleteExtendedTab(tab);

    if (tab.mode === "ADMIN") {
      useWebTerminalStore().clearQueryStateByTab(id);
    }
  };
  const updateTab = (id: string, payload: Partial<SQLEditorTab>) => {
    const tab = tabById(id);
    if (!tab) return;
    Object.assign(tab, payload);
  };
  const updateCurrentTab = (payload: Partial<SQLEditorTab>) => {
    const id = currentTabId.value;
    if (!id) return;
    updateTab(id, payload);
  };
  const updateBatchQueryContext = (payload: Partial<BatchQueryContext>) => {
    const tab = currentTab.value;
    if (!tab) {
      return;
    }
    updateTab(tab.id, {
      batchQueryContext: {
        databases: tab.batchQueryContext?.databases ?? [],
        dataSourceType:
          tab.batchQueryContext?.dataSourceType ?? DataSourceType.READ_ONLY,
        ...tab.batchQueryContext,
        ...payload,
      },
    });
  };

  // removeDatabaseQueryContext remove the context by id, and returns the next context.
  const removeDatabaseQueryContext = ({
    database,
    contextId,
  }: {
    database: string;
    contextId: string;
  }): SQLEditorDatabaseQueryContext | undefined => {
    const tab = tabById(currentTabId.value);
    if (!tab || !tab.databaseQueryContexts) {
      return;
    }
    if (!tab.databaseQueryContexts.has(database)) {
      return;
    }
    const contexts = tab.databaseQueryContexts.get(database)!;
    const index = contexts.findIndex((context) => context.id === contextId);
    if (index < 0) {
      return;
    }
    contexts.splice(index, 1);
    return contexts[index] || contexts[index - 1];
  };

  const batchRemoveDatabaseQueryContext = ({
    database,
    contextIds,
  }: {
    database: string;
    contextIds: string[];
  }) => {
    const tab = tabById(currentTabId.value);
    if (!tab || !tab.databaseQueryContexts) {
      return;
    }
    if (!tab.databaseQueryContexts.has(database)) {
      return;
    }
    const target = new Set(contextIds);
    const contexts = tab.databaseQueryContexts.get(database)!;
    const newContexts = contexts.filter((ctx) => !target.has(ctx.id));
    tab.databaseQueryContexts.set(database, newContexts);
  };

  const deleteDatabaseQueryContext = (database: string) => {
    const tab = tabById(currentTabId.value);
    if (!tab || !tab.databaseQueryContexts) {
      return;
    }
    tab.databaseQueryContexts.delete(database);
  };

  const updateDatabaseQueryContext = ({
    database,
    contextId,
    context,
  }: {
    database: string;
    contextId: string;
    context: Partial<SQLEditorDatabaseQueryContext>;
  }) => {
    const tab = tabById(currentTabId.value);
    if (!tab || !tab.databaseQueryContexts) {
      return;
    }
    if (!tab.databaseQueryContexts.has(database)) {
      return;
    }
    const target = tab.databaseQueryContexts
      .get(database)
      ?.find((c) => c.id === contextId);
    if (!target) {
      return;
    }
    Object.assign(target, context);
    return target;
  };

  const setCurrentTabId = (id: string) => {
    currentTabId.value = id;
  };
  const selectOrAddSimilarNewTab = (
    tab: CoreSQLEditorTab,
    beside = false,
    defaultTitle?: string,
    ignoreMode?: boolean
  ) => {
    const curr = currentTab.value;
    if (curr) {
      if (
        isDisconnectedSQLEditorTab(curr) ||
        isSimilarSQLEditorTab(tab, curr, ignoreMode)
      ) {
        curr.connection = tab.connection;
        curr.worksheet = tab.worksheet;
        curr.mode = tab.mode;
        if (
          defaultTitle &&
          tabViewStateStore.getViewState(curr.id).view === "CODE"
        ) {
          curr.title = defaultTitle;
        }
        return;
      }
    }
    const similarNewTab = tabList.value.find(
      (tmp) => tmp.status === "NEW" && isSimilarSQLEditorTab(tmp, tab)
    );
    if (similarNewTab) {
      setCurrentTabId(similarNewTab.id);
    } else {
      addTab(
        {
          ...tab,
          title: defaultTitle,
        },
        beside
      );
    }
  };
  // watch the field changes of a tab, store it to localStorage
  // when needed, but not to frequently (for performance consideration)
  const watchTab = (tab: SQLEditorTab, immediate: boolean) => {
    // Use a throttled watcher to reduce the performance overhead when writing.
    watchThrottled(
      () => pick(tab, ...PERSISTENT_TAB_FIELDS) as PersistentTab,
      (persistentTab) => {
        getStorage().save<PersistentTab>(
          keyForTab(persistentTab.id),
          persistentTab
        );
      },
      { deep: true, immediate, throttle: 100, trailing: true }
    );
    watchThrottled(
      () => pick(tab, EXTENDED_TAB_FIELDS) as ExtendedTab,
      (extended) => {
        saveExtendedTab(tab, extended);
      },
      { deep: true, immediate, throttle: 100, trailing: true }
    );
  };
  // Load tabs session from localStorage
  // Reset if failed
  const initAll = () => {
    const projects = Object.keys(tabIdListMapByProject.value);
    // initialize all stored projects
    projects.forEach((project) => {
      maybeInitProject(project);
    });
    // initialize current project if needed (when it's not stored)
    maybeInitProject(project.value);
  };
  initAll();

  // some shortcuts
  const isDisconnected = computed(() => {
    const tab = currentTab.value;
    if (!tab) return true;
    return isDisconnectedSQLEditorTab(tab);
  });

  const isSwitchingTab = ref(false);
  watch(
    currentTabId,
    () => {
      isSwitchingTab.value = true;
      nextTick(() => {
        isSwitchingTab.value = false;
      });
    },
    {
      immediate: true,
    }
  );

  return {
    tabIdList,
    tabList,
    currentTabId,
    currentTab,
    tabById,
    addTab,
    removeTab,
    updateTab,
    updateCurrentTab,
    updateBatchQueryContext,
    updateDatabaseQueryContext,
    removeDatabaseQueryContext,
    batchRemoveDatabaseQueryContext,
    deleteDatabaseQueryContext,
    setCurrentTabId,
    selectOrAddSimilarNewTab,
    maybeInitProject,
    isDisconnected,
    isSwitchingTab,
    isInBatchMode,
  };
});

export const useCurrentSQLEditorTab = () => {
  return storeToRefs(useSQLEditorTabStore()).currentTab;
};

export const isSQLEditorTabClosable = (tab: SQLEditorTab) => {
  const { tabList } = useSQLEditorTabStore();

  if (tabList.length > 1) {
    // Not the only one tab
    return true;
  }
  if (tabList.length === 1) {
    // It's the only one tab, and it's closable if it's a sheet tab
    return !!tab.worksheet;
  }
  return false;
};

export const useSQLEditorConnectionDetail = (
  connection: MaybeRef<SQLEditorConnection>
) => {
  const { database } = useDatabaseV1ByName(
    computed(() => unref(connection).database)
  );

  const instance = computed(() => {
    return database.value.instanceResource;
  });

  const environment = computed(() => {
    if (isValidDatabaseName(database.value.name)) {
      return database.value.effectiveEnvironmentEntity;
    }

    return useEnvironmentV1Store().getEnvironmentByName(
      instance.value.environment
    );
  });

  return { connection, instance, database, environment };
};

export const useConnectionOfCurrentSQLEditorTab = () => {
  const store = useSQLEditorTabStore();
  const connection = computed(() => {
    return store.currentTab?.connection ?? emptySQLEditorConnection();
  });

  const { instance, database, environment } =
    useSQLEditorConnectionDetail(connection);

  return { connection, instance, database, environment };
};

export const resolveOpeningDatabaseListFromSQLEditorTabList = () => {
  const { tabList } = useSQLEditorTabStore();
  const databaseStore = useDatabaseV1Store();
  const databaseSet = new Set<string>();

  for (const tab of tabList) {
    const { database } = tab.connection;
    if (database) {
      const db = databaseStore.getDatabaseByName(database);
      databaseSet.add(db.name);
    }
  }
  return databaseSet;
};
