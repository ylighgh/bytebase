<template>
  <NButton size="small" :loading="hasRunningPlanCheck" @click="handleRunChecks">
    <template #icon>
      <PlayIcon />
    </template>
    {{ hasRunningPlanCheck ? $t("task.checking") : $t("task.run-checks") }}
  </NButton>
</template>

<script setup lang="ts">
import { PlayIcon } from "lucide-vue-next";
import { NButton } from "naive-ui";
import { computed } from "vue";
import type { PlanCheckRun } from "@/types/proto-es/v1/plan_service_pb";
import { PlanCheckRun_Status } from "@/types/proto-es/v1/plan_service_pb";

const props = defineProps<{
  planCheckRunList: PlanCheckRun[];
}>();

const emit = defineEmits<{
  (event: "run-checks"): void;
}>();

const hasRunningPlanCheck = computed((): boolean => {
  return props.planCheckRunList.some(
    (checkRun) => checkRun.status === PlanCheckRun_Status.RUNNING
  );
});

const handleRunChecks = () => {
  if (hasRunningPlanCheck.value) return;
  emit("run-checks");
};
</script>
