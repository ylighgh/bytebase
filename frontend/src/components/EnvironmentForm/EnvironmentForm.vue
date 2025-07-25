<template>
  <slot />

  <FeatureModal
    :open="missingFeature != undefined"
    :feature="missingFeature"
    @cancel="missingFeature = undefined"
  />
</template>

<script lang="ts" setup>
import { useEventListener } from "@vueuse/core";
import { toRef } from "vue";
import { useI18n } from "vue-i18n";
import { onBeforeRouteLeave } from "vue-router";
import { useEmitteryEventListener } from "@/composables/useEmitteryEventListener";
import { hasFeature } from "@/store";
import { VirtualRoleType } from "@/types";
import type { Policy } from "@/types/proto-es/v1/org_policy_service_pb";
import { PolicyType } from "@/types/proto-es/v1/org_policy_service_pb";
import { PlanFeature } from "@/types/proto-es/v1/subscription_service_pb";
import type { Environment } from "@/types/v1/environment";
import { FeatureModal } from "../FeatureGuard";
import { provideEnvironmentFormContext } from "./context";

const props = withDefaults(
  defineProps<{
    create?: boolean;
    environment: Environment;
    rolloutPolicy: Policy;
  }>(),
  {
    create: false,
  }
);

const emit = defineEmits<{
  (
    event: "create",
    params: {
      environment: Partial<Environment>;
      rolloutPolicy: Policy;
    }
  ): void;
  (event: "update", environment: Environment): void;
  (
    event: "update-policy",
    params: {
      environment: Environment;
      policyType: PolicyType;
      policy: Policy;
    }
  ): void;
  (event: "delete", environment: Environment): void;
  (event: "cancel"): void;
}>();

const { t } = useI18n();
const context = provideEnvironmentFormContext({
  create: toRef(props, "create"),
  environment: toRef(props, "environment"),
  rolloutPolicy: toRef(props, "rolloutPolicy"),
});
const { valueChanged, events, missingFeature } = context;

useEventListener("beforeunload", (e) => {
  if (props.create || !valueChanged()) {
    return;
  }
  e.returnValue = t("common.leave-without-saving");
  return e.returnValue;
});

onBeforeRouteLeave((to, from, next) => {
  if (!props.create && valueChanged()) {
    if (!window.confirm(t("common.leave-without-saving"))) {
      return;
    }
  }
  next();
});

useEmitteryEventListener(events, "create", (params) => {
  const { rolloutPolicy, environment } = params;
  if (environment.tags?.protected === "protected") {
    if (!hasFeature(PlanFeature.FEATURE_ENVIRONMENT_TIERS)) {
      missingFeature.value = PlanFeature.FEATURE_ENVIRONMENT_TIERS;
      return;
    }
  }
  const rp =
    rolloutPolicy.policy.case === "rolloutPolicy"
      ? rolloutPolicy.policy.value
      : undefined;
  if (rp?.automatic === false) {
    if (rp.issueRoles.includes(VirtualRoleType.LAST_APPROVER)) {
      if (!hasFeature(PlanFeature.FEATURE_APPROVAL_WORKFLOW)) {
        missingFeature.value = PlanFeature.FEATURE_APPROVAL_WORKFLOW;
        return;
      }
    }
  }

  emit("create", params);
});
useEmitteryEventListener(events, "update", (environment) => {
  if (
    environment.tags.protected === "protected" &&
    !hasFeature(PlanFeature.FEATURE_ENVIRONMENT_TIERS)
  ) {
    missingFeature.value = PlanFeature.FEATURE_ENVIRONMENT_TIERS;
    return;
  }

  emit("update", environment);
});
useEmitteryEventListener(events, "update-policy", (params) => {
  const { policyType, policy } = params;
  if (policyType === PolicyType.ROLLOUT_POLICY) {
    const rp =
      policy.policy.case === "rolloutPolicy" ? policy.policy.value : undefined;
    if (rp?.automatic === false) {
      if (rp.issueRoles.includes(VirtualRoleType.LAST_APPROVER)) {
        if (!hasFeature(PlanFeature.FEATURE_APPROVAL_WORKFLOW)) {
          missingFeature.value = PlanFeature.FEATURE_APPROVAL_WORKFLOW;
          return;
        }
      }
    }
  }

  emit("update-policy", params);
});
useEmitteryEventListener(events, "delete", (environment) => {
  emit("delete", environment);
});
useEmitteryEventListener(events, "cancel", () => {
  emit("cancel");
});
</script>
