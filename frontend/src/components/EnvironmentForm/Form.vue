<template>
  <div>
    <div class="flex flex-col gap-y-6">
      <div v-if="features.includes('BASE')" class="flex flex-col gap-y-2">
        <div for="name" class="flex item-center space-x-2">
          <div class="w-4 h-4 relative">
            <component :is="renderColorPicker()" />
          </div>
          <span for="name" class="font-medium">
            {{ $t("common.environment-name") }}
            <span class="text-red-600">*</span>
          </span>
        </div>
        <NInput
          v-model:value="state.environment.title"
          :disabled="!allowEdit"
          required
        />

        <ResourceIdField
          ref="resourceIdField"
          resource-type="environment"
          :readonly="!create"
          :value="state.environment.id"
          :resource-title="state.environment.title"
          :fetch-resource="
            (id) =>
              environmentStore.getOrFetchEnvironmentByName(
                `${environmentNamePrefix}${id}`,
                true /* silent */
              )
          "
        />
      </div>

      <div v-if="features.includes('TIER')" class="flex flex-col gap-y-2">
        <label class="font-medium flex items-center">
          {{ $t("policy.environment-tier.name") }}
          <FeatureBadge :feature="PlanFeature.FEATURE_ENVIRONMENT_TIERS" />
        </label>
        <p class="text-sm text-gray-600">
          <i18n-t tag="span" keypath="policy.environment-tier.description">
            <template #newline><br /></template>
          </i18n-t>
          <a
            class="inline-flex items-center text-blue-600 ml-1 hover:underline"
            href="https://docs.bytebase.com/administration/environment-policy/overview/?source=console#environment-tier"
            target="_blank"
            >{{ $t("common.learn-more")
            }}<heroicons-outline:external-link class="w-4 h-4"
          /></a>
        </p>
        <NCheckbox
          :checked="state.environment.tags.protected === 'protected'"
          :disabled="!allowEdit"
          @update:checked="
            (on: boolean) => {
              state.environment.tags.protected = on
                ? 'protected'
                : 'unprotected';
            }
          "
        >
          {{ $t("policy.environment-tier.mark-env-as-production") }}
        </NCheckbox>
      </div>

      <div
        v-if="features.includes('ROLLOUT_POLICY')"
        class="flex flex-col gap-y-2"
      >
        <div class="flex items-baseline space-x-2">
          <label class="font-medium">
            {{ $t("policy.rollout.name") }}
          </label>
          <span
            v-show="!create && valueChanged('rolloutPolicy')"
            class="textlabeltip"
          >
            {{ $t("policy.rollout.tip") }}
          </span>
        </div>
        <div class="textinfolabel">
          {{ $t("policy.rollout.info", { permission: "bb.taskRuns.create" }) }}
          <a
            class="inline-flex items-center text-blue-600 ml-1 hover:underline"
            href="https://docs.bytebase.com/administration/environment-policy/rollout-policy"
            target="_blank"
          >
            {{ $t("common.learn-more") }}
            <heroicons-outline:external-link class="w-4 h-4" />
          </a>
        </div>
        <RolloutPolicyConfig
          v-model:policy="state.rolloutPolicy"
          :disabled="!allowEdit"
        />
      </div>

      <SQLReviewForResource
        v-if="features.includes('SQL_REVIEW') && !create"
        ref="sqlReviewForResourceRef"
        :resource="`${environmentNamePrefix}${environment.id}`"
        :allow-edit="allowEdit"
      />

      <AccessControlConfigure
        v-if="features.includes('ACCESS_CONTROL') && !create"
        ref="accessControlConfigureRef"
        :resource="`${environmentNamePrefix}${environment.id}`"
        :allow-edit="allowEdit"
      />
    </div>

    <div
      v-if="!create"
      class="mt-6 border-t border-block-border flex justify-between items-center pt-4 pb-2"
    >
      <BBButtonConfirm
        v-if="allowArchive"
        :type="'DELETE'"
        :button-text="$t('environment.delete')"
        :ok-text="$t('common.delete')"
        :confirm-title="
          $t('environment.delete') + ` '${state.environment.title}'?`
        "
        :confirm-description="$t('common.cannot-undo-this-action')"
        :require-confirm="true"
        @confirm="deleteEnvironment"
      />
      <div v-else></div>
    </div>
  </div>
</template>

<script lang="tsx" setup>
import { NCheckbox, NInput, NColorPicker } from "naive-ui";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { BBButtonConfirm } from "@/bbkit";
import { useEmitteryEventListener } from "@/composables/useEmitteryEventListener";
import {
  useEnvironmentV1List,
  useEnvironmentV1Store,
  hasFeature,
  pushNotification,
} from "@/store";
import { environmentNamePrefix } from "@/store/modules/v1/common";
import { PlanFeature } from "@/types/proto-es/v1/subscription_service_pb";
import { FeatureBadge } from "../FeatureGuard";
import SQLReviewForResource from "../SQLReview/components/SQLReviewForResource.vue";
import { ResourceIdField } from "../v2";
import AccessControlConfigure from "./AccessControlConfigure.vue";
import RolloutPolicyConfig from "./RolloutPolicyConfig.vue";
import { useEnvironmentFormContext } from "./context";

withDefaults(
  defineProps<{
    features?: Array<
      "BASE" | "TIER" | "ROLLOUT_POLICY" | "SQL_REVIEW" | "ACCESS_CONTROL"
    >;
  }>(),
  {
    features: () => [
      "BASE",
      "TIER",
      "ROLLOUT_POLICY",
      "SQL_REVIEW",
      "ACCESS_CONTROL",
    ],
  }
);

const { t } = useI18n();
const {
  create,
  environment,
  state,
  allowEdit,
  valueChanged,
  missingFeature,
  hasPermission,
  events,
  resourceIdField,
} = useEnvironmentFormContext();
const environmentList = useEnvironmentV1List();
const environmentStore = useEnvironmentV1Store();

const accessControlConfigureRef =
  ref<InstanceType<typeof AccessControlConfigure>>();
const sqlReviewForResourceRef =
  ref<InstanceType<typeof SQLReviewForResource>>();

watch(
  () => [
    accessControlConfigureRef.value?.isDirty ?? false,
    sqlReviewForResourceRef.value?.isDirty ?? false,
  ],
  ([d1, d2]) => {
    if (d1 || d2) {
      state.value.policyChanged = true;
    } else if (!d1 && !d2) {
      state.value.policyChanged = false;
    }
  }
);

const hasEnvironmentPolicyFeature = computed(() =>
  hasFeature(PlanFeature.FEATURE_ENVIRONMENT_TIERS)
);

const allowArchive = computed(() => {
  return hasPermission("bb.settings.set") && environmentList.value.length > 1;
});

const renderColorPicker = () => {
  return (
    <NColorPicker
      class="!w-full !h-full"
      modes={["hex"]}
      showAlpha={false}
      value={state.value.environment.color || "#4f46e5"}
      renderLabel={() => (
        <div
          class="w-5 h-5 rounded cursor-pointer relative"
          style={{
            backgroundColor: state.value.environment.color || "#4f46e5",
          }}
        ></div>
      )}
      onComplete={(color: string) => {
        if (color.toUpperCase() === "#FFFFFF") {
          pushNotification({
            module: "bytebase",
            style: "WARN",
            title: t("common.warning"),
            description: "Invalid color",
          });
          state.value.environment.color = "#4f46e5";
          return;
        }
      }}
      onUpdateValue={(color: string) => {
        if (!hasEnvironmentPolicyFeature.value) {
          missingFeature.value = PlanFeature.FEATURE_ENVIRONMENT_TIERS;
          return;
        }
        state.value.environment.color = color;
      }}
    />
  );
};

const deleteEnvironment = () => {
  events.emit("delete", state.value.environment);
};

useEmitteryEventListener(events, "update-access-control", async () => {
  if (accessControlConfigureRef.value?.isDirty) {
    await accessControlConfigureRef.value.update();
  }
});
useEmitteryEventListener(events, "revert-access-control", () => {
  accessControlConfigureRef.value?.revert();
});
useEmitteryEventListener(events, "update-sql-review", async () => {
  if (sqlReviewForResourceRef.value?.isDirty) {
    await sqlReviewForResourceRef.value.update();
  }
});
useEmitteryEventListener(events, "revert-sql-review", () => {
  sqlReviewForResourceRef.value?.revert();
});
</script>
