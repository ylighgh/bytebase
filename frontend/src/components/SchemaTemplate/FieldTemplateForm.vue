<template>
  <DrawerContent :title="$t('schema-template.field-template.self')">
    <div class="space-y-6 divide-y divide-block-border">
      <div class="space-y-6">
        <!-- category -->
        <div class="sm:col-span-2 sm:col-start-1">
          <label for="category" class="textlabel">
            {{ $t("schema-template.form.category") }}
          </label>
          <p class="text-sm text-gray-500 mb-2">
            {{ $t("schema-template.form.category-desc") }}
          </p>
          <div class="relative flex flex-row justify-between items-center mt-1">
            <DropdownInput
              v-model:value="state.category"
              :options="categoryOptions"
              :placeholder="$t('schema-template.form.unclassified')"
              :disabled="readonly"
              :consistent-menu-width="true"
              :allow-filter="true"
            />
          </div>
        </div>

        <div class="w-full mb-6 space-y-1">
          <label for="engine" class="textlabel">
            {{ $t("database.engine") }}
          </label>
          <InstanceEngineRadioGrid
            v-model:engine="state.engine"
            :engine-list="engineList"
            :disabled="readonly"
            class="grid-cols-4 gap-2"
          />
        </div>
      </div>
      <div class="space-y-6 pt-6">
        <div class="grid grid-cols-1 gap-y-6 gap-x-4 sm:grid-cols-4">
          <!-- column name -->
          <div class="sm:col-span-2 sm:col-start-1">
            <label for="column-name" class="textlabel">
              {{ $t("schema-template.form.column-name") }}
              <span class="text-red-600 mr-2">*</span>
            </label>
            <NInput
              v-model:value="state.column!.name"
              placeholder="column name"
              :disabled="readonly"
            />
          </div>

          <div class="sm:col-span-1 sm:col-start-1">
            <label for="semantic-types" class="textlabel">
              {{
                $t("settings.sensitive-data.semantic-types.table.semantic-type")
              }}
            </label>
            <div class="flex items-center gap-x-2 mt-3 text-sm">
              {{ columnSemanticType?.title }}
              <div v-if="!readonly" class="flex items-center">
                <MiniActionButton
                  v-if="columnSemanticType"
                  @click.prevent="onSemanticTypeApply('')"
                >
                  <XIcon class="w-4 h-4" />
                </MiniActionButton>
                <MiniActionButton
                  @click.prevent="state.showSemanticTypesDrawer = true"
                >
                  <PencilIcon class="w-4 h-4" />
                </MiniActionButton>
              </div>
            </div>
          </div>

          <div v-if="classificationConfig" class="sm:col-span-2">
            <label for="column-name" class="textlabel">
              {{ $t("schema-template.classification.self") }}
            </label>
            <div class="flex items-center gap-x-2 mt-3">
              <ClassificationLevelBadge
                :classification="state.catalog?.classification"
                :classification-config="classificationConfig"
              />
              <div v-if="!readonly" class="flex items-center">
                <MiniActionButton
                  v-if="state.catalog?.classification"
                  @click.prevent="state.catalog!.classification = ''"
                >
                  <XIcon class="w-4 h-4" />
                </MiniActionButton>
                <MiniActionButton
                  @click.prevent="state.showClassificationDrawer = true"
                >
                  <PencilIcon class="w-4 h-4" />
                </MiniActionButton>
              </div>
            </div>
          </div>

          <!-- type -->
          <div class="sm:col-span-2 sm:col-start-1">
            <label for="column-type" class="textlabel">
              {{ $t("schema-template.form.column-type") }}
              <span class="text-red-600 mr-2">*</span>
            </label>
            <div
              class="relative flex flex-row justify-between items-center mt-1"
            >
              <DropdownInput
                :value="state.column!.type || null"
                :allow-input-value="
                  schemaTemplateColumnTypeOptions.length === 0
                "
                :options="
                  schemaTemplateColumnTypeOptions.length > 0
                    ? schemaTemplateColumnTypeOptions
                    : dataTypeOptions
                "
                :disabled="readonly"
                :allow-filter="true"
                placeholder="column type"
                @update:value="state.column!.type = $event"
              />
            </div>
          </div>

          <!-- default value -->
          <div class="sm:col-span-2 sm:col-start-1">
            <label for="default-value" class="textlabel">
              {{ $t("schema-template.form.default-value") }}
            </label>
            <div class="flex flex-row items-center relative">
              <DropdownInput
                :value="getColumnDefaultDisplayString(state.column!) || null"
                :options="defaultValueOptions"
                :disabled="readonly"
                :allow-filter="true"
                :placeholder="getColumnDefaultValuePlaceholder(state.column!)"
                @update:value="handleColumnDefaultChange"
              />
            </div>
          </div>

          <!-- nullable -->
          <div class="sm:col-span-2 ml-0 sm:ml-3">
            <label for="nullable" class="textlabel">
              {{ $t("schema-template.form.nullable") }}
            </label>
            <div class="flex flex-row items-center h-[34px]">
              <NSwitch
                v-model:value="state.column!.nullable"
                :text="false"
                :disabled="readonly"
              />
            </div>
          </div>

          <!-- on update -->
          <div class="sm:col-span-2 sm:col-start-1">
            <label for="default-value" class="textlabel">
              {{ $t("schema-template.form.on-update") }}
            </label>
            <div class="flex flex-row items-center relative">
              <NInput v-model:value="state.column!.onUpdate" />
            </div>
          </div>

          <!-- comment -->
          <div class="sm:col-span-4 sm:col-start-1">
            <label for="comment" class="textlabel">
              {{ $t("schema-template.form.comment") }}
            </label>
            <NInput
              v-model:value="state.column!.userComment"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 3 }"
              :disabled="readonly"
            />
          </div>
        </div>
      </div>

      <div class="space-y-1 pt-6">
        <label for="category" class="textlabel">
          {{ $t("common.labels") }}
        </label>
        <LabelListEditor
          ref="labelListEditorRef"
          v-model:kv-list="state.kvList"
          :readonly="!!readonly"
          :show-errors="dirty"
          class="max-w-[30rem]"
        />
      </div>
    </div>

    <template #footer>
      <div class="w-full flex justify-between items-center">
        <div class="w-full flex justify-end items-center gap-x-3">
          <NButton @click.prevent="$emit('dismiss')">
            {{ $t("common.cancel") }}
          </NButton>
          <NButton
            v-if="!readonly"
            :disabled="submitDisabled"
            type="primary"
            @click.prevent="submit"
          >
            {{ create ? $t("common.create") : $t("common.update") }}
          </NButton>
        </div>
      </div>
    </template>
  </DrawerContent>

  <SelectClassificationDrawer
    v-if="classificationConfig"
    :show="state.showClassificationDrawer"
    :classification-config="classificationConfig"
    @dismiss="state.showClassificationDrawer = false"
    @apply="onClassificationSelect"
  />

  <ColumnDefaultValueExpressionModal
    v-if="state.showColumnDefaultValueExpressionModal"
    :expression="state.column!.default"
    @close="state.showColumnDefaultValueExpressionModal = false"
    @update:expression="handleSelectedColumnDefaultValueExpressionChange"
  />

  <SemanticTypesDrawer
    :show="state.showSemanticTypesDrawer"
    :semantic-type-list="semanticTypeList"
    @dismiss="state.showSemanticTypesDrawer = false"
    @apply="onSemanticTypeApply($event)"
  />
</template>

<script lang="ts" setup>
import { create as createProto } from "@bufbuild/protobuf";
import { isEqual, cloneDeep } from "lodash-es";
import { XIcon, PencilIcon } from "lucide-vue-next";
import type { SelectOption } from "naive-ui";
import { NButton, NInput, NSwitch } from "naive-ui";
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import { LabelListEditor } from "@/components/Label";
import {
  getColumnDefaultDisplayString,
  getColumnDefaultValuePlaceholder,
  getDefaultValueByKey,
  getColumnDefaultValueOptions,
} from "@/components/SchemaEditorLite";
import { ColumnDefaultValueExpressionModal } from "@/components/SchemaEditorLite";
import SemanticTypesDrawer from "@/components/SensitiveData/components/SemanticTypesDrawer.vue";
import {
  DrawerContent,
  DropdownInput,
  InstanceEngineRadioGrid,
  MiniActionButton,
} from "@/components/v2";
import { useSettingV1Store, useNotificationStore } from "@/store";
import { ColumnCatalogSchema } from "@/types/proto-es/v1/database_catalog_service_pb";
import { ColumnMetadataSchema } from "@/types/proto-es/v1/database_service_pb";
import type { SchemaTemplateSetting_FieldTemplate } from "@/types/proto-es/v1/setting_service_pb";
import {
  SchemaTemplateSetting_FieldTemplateSchema,
  SchemaTemplateSettingSchema,
  Setting_SettingName,
  ValueSchema as SettingValueSchema,
} from "@/types/proto-es/v1/setting_service_pb";
import {
  getDataTypeSuggestionList,
  convertKVListToLabels,
  convertLabelsToKVList,
} from "@/utils";
import ClassificationLevelBadge from "./ClassificationLevelBadge.vue";
import SelectClassificationDrawer from "./SelectClassificationDrawer.vue";
import { engineList, categoryList, classificationConfig } from "./utils";

const props = defineProps<{
  create: boolean;
  readonly?: boolean;
  template: SchemaTemplateSetting_FieldTemplate;
}>();

const emit = defineEmits(["dismiss"]);

interface LocalState extends SchemaTemplateSetting_FieldTemplate {
  showClassificationDrawer: boolean;
  showSemanticTypesDrawer: boolean;
  showColumnDefaultValueExpressionModal: boolean;
  kvList: { key: string; value: string }[];
}

const state = reactive<LocalState>({
  ...createProto(SchemaTemplateSetting_FieldTemplateSchema, {
    id: props.template.id,
    engine: props.template.engine,
    category: props.template.category,
    column: createProto(ColumnMetadataSchema, props.template.column ?? {}),
    catalog: createProto(ColumnCatalogSchema, props.template.catalog ?? {}),
  }),
  showClassificationDrawer: false,
  showSemanticTypesDrawer: false,
  showColumnDefaultValueExpressionModal: false,
  kvList: [],
});
const { t } = useI18n();
const settingStore = useSettingV1Store();

const semanticTypeList = computed(() => {
  const setting = settingStore.getSettingByName(
    Setting_SettingName.SEMANTIC_TYPES
  );
  if (!setting?.value?.value) return [];
  const value = setting.value.value;
  if (value.case === "semanticTypeSettingValue") {
    return value.value.types ?? [];
  }
  return [];
});

const columnSemanticType = computed(() => {
  if (!state.catalog?.semanticType) {
    return;
  }
  return semanticTypeList.value.find(
    (data) => data.id === state.catalog?.semanticType
  );
});

const convert = () => {
  return convertLabelsToKVList(
    props.template.catalog?.labels ?? {},
    true /* sort */
  );
};

watch(
  () => props.template.catalog?.labels,
  () => {
    state.kvList = convert();
  },
  {
    immediate: true,
    deep: true,
  }
);

const dirty = computed(() => {
  const original = convert();
  const local = state.kvList;
  return !isEqual(original, local);
});

const dataTypeOptions = computed(() => {
  return getDataTypeSuggestionList(state.engine).map<SelectOption>(
    (dataType) => {
      return {
        label: dataType,
        value: dataType,
      };
    }
  );
});

const categoryOptions = computed(() => {
  return categoryList.value.map<SelectOption>((category) => ({
    label: category,
    value: category,
  }));
});

const defaultValueOptions = computed(() => {
  if (!state.column) return [];
  return getColumnDefaultValueOptions(
    state.engine,
    state.column.type
  ).map<SelectOption>((opt) => ({
    value: opt.key,
    label: opt.label as string,
    defaultValue: opt.value,
  }));
});

const schemaTemplateColumnTypes = computed(() => {
  const setting = settingStore.getSettingByName(
    Setting_SettingName.SCHEMA_TEMPLATE
  );
  if (!setting?.value?.value) return [];
  const value = setting.value.value;
  if (value.case !== "schemaTemplateSettingValue") return [];
  const columnTypes = value.value.columnTypes;
  if (columnTypes && columnTypes.length > 0) {
    const columnType = columnTypes.find(
      (columnType) => columnType.engine === state.engine
    );
    if (columnType && columnType.enabled) {
      return columnType.types;
    }
  }
  return [];
});
const schemaTemplateColumnTypeOptions = computed(() => {
  return schemaTemplateColumnTypes.value.map<SelectOption>((type) => ({
    label: type,
    value: type,
  }));
});

const submitDisabled = computed(() => {
  if (!state.column?.name || !state.column?.type) {
    return true;
  }
  if (!props.create && isEqual(props.template, state)) {
    return true;
  }
  return false;
});

const submit = async () => {
  const template = createProto(SchemaTemplateSetting_FieldTemplateSchema, {
    id: state.id,
    engine: state.engine,
    category: state.category,
    column: state.column,
    catalog: createProto(ColumnCatalogSchema, {
      semanticType: state.catalog?.semanticType || "",
      classification: state.catalog?.classification || "",
      name: state.column?.name || "",
      labels: convertKVListToLabels(
        state.kvList.filter((item) => item.key),
        false /* !omitEmpty */
      ),
    }),
  });
  const setting = await settingStore.fetchSettingByName(
    Setting_SettingName.SCHEMA_TEMPLATE
  );

  let settingValue = createProto(SchemaTemplateSettingSchema, {});
  if (
    setting?.value?.value &&
    setting.value.value.case === "schemaTemplateSettingValue"
  ) {
    settingValue = cloneDeep(setting.value.value.value);
  }

  const index = settingValue.fieldTemplates.findIndex(
    (t) => t.id === template.id
  );
  if (index >= 0) {
    settingValue.fieldTemplates[index] = template;
  } else {
    settingValue.fieldTemplates.push(template);
  }

  await settingStore.upsertSetting({
    name: Setting_SettingName.SCHEMA_TEMPLATE,
    value: createProto(SettingValueSchema, {
      value: {
        case: "schemaTemplateSettingValue",
        value: settingValue,
      },
    }),
  });
  useNotificationStore().pushNotification({
    module: "bytebase",
    style: "SUCCESS",
    title: t("common.updated"),
  });
  emit("dismiss");
};

const onClassificationSelect = (id: string) => {
  if (!state.catalog) {
    return;
  }
  state.catalog.classification = id;
};

const handleColumnDefaultChange = (key: string) => {
  const value = getDefaultValueByKey(key);
  if (value) {
    handleColumnDefaultSelect(key);
    return;
  }

  handleColumnDefaultInput(key);
};
const handleColumnDefaultInput = (value: string) => {
  const { column } = state;
  if (!column) return;

  column.hasDefault = true;
  column.default = value;
};
const handleColumnDefaultSelect = (key: string) => {
  const { column } = state;
  if (!column) return;

  if (key === "expression") {
    state.showColumnDefaultValueExpressionModal = true;
    return;
  }

  const defaultValue = getDefaultValueByKey(key);
  if (!defaultValue || !state.column) {
    return;
  }

  state.column.hasDefault = defaultValue.hasDefault;
  state.column.default = defaultValue.default;
  if (state.column.hasDefault && state.column.default === "NULL") {
    state.column.nullable = true;
  }
};

const handleSelectedColumnDefaultValueExpressionChange = (
  expression: string
) => {
  if (!state.column) {
    return;
  }
  state.column.hasDefault = true;
  state.column.default = expression;
  state.showColumnDefaultValueExpressionModal = false;
};

const onSemanticTypeApply = async (semanticType: string) => {
  state.catalog = createProto(ColumnCatalogSchema, {
    name: state.catalog?.name,
    labels: state.catalog?.labels,
    classification: state.catalog?.classification,
    semanticType,
  });
};
</script>
