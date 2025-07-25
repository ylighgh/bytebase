<template>
  <NTooltip>
    <template #trigger>
      <span
        class="flex items-center justify-center rounded-full select-none overflow-hidden shrink-0"
        :class="issueIconClass()"
      >
        <template v-if="issueStatus === IssueStatus.OPEN">
          <template v-if="taskStatus === Task_Status.RUNNING">
            <div class="flex h-2 w-2 relative overflow-visible">
              <span
                class="w-full h-full rounded-full z-0 absolute animate-ping-slow"
                style="
                  background-color: rgba(37, 99, 235, 0.5); /* bg-info/50 */
                "
                aria-hidden="true"
              ></span>
              <span
                class="w-full h-full rounded-full z-[1] bg-info"
                aria-hidden="true"
              ></span>
            </div>
          </template>
          <span
            v-else-if="taskStatus === Task_Status.FAILED"
            class="h-2 w-2 rounded-full text-center pb-6 font-normal text-base"
            aria-hidden="true"
            >!</span
          >
          <span
            v-else
            class="h-1.5 w-1.5 bg-info rounded-full"
            aria-hidden="true"
          ></span>
        </template>
        <template v-else-if="issueStatus === IssueStatus.DONE">
          <heroicons-solid:check class="w-4 h-4" />
        </template>
        <template v-else-if="issueStatus === IssueStatus.CANCELED">
          <heroicons-solid:minus class="w-5 h-5" />
        </template>
      </span>
    </template>

    <template #default>
      <div class="max-w-[24rem]">
        {{
          isUnfinishedResolvedIssue
            ? $t("issue.unfinished-resolved-issue-tips")
            : stringifyIssueStatus(props.issueStatus)
        }}
      </div>
    </template>
  </NTooltip>
</template>

<script lang="ts" setup>
import { NTooltip } from "naive-ui";
import type { PropType } from "vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { ComposedIssue } from "@/types";
import { IssueStatus } from "@/types/proto-es/v1/issue_service_pb";
import { Task_Status } from "@/types/proto-es/v1/rollout_service_pb";
import { isUnfinishedResolvedTask as checkUnfinishedResolvedTask } from "../logic";

export type SizeType = "small" | "normal";

const props = defineProps({
  issueStatus: {
    required: true,
    type: Number as PropType<IssueStatus>,
  },
  // Specify taskStatus if we want to show the task specific status when issueStatus is OPEN.
  taskStatus: {
    type: Number as PropType<Task_Status>,
    default: undefined,
  },
  size: {
    type: String as PropType<SizeType>,
    default: "normal",
  },
  issue: {
    type: Object as PropType<ComposedIssue>,
    default: undefined,
  },
});

const { t } = useI18n();

const issueIconClass = () => {
  const iconClass = props.size === "normal" ? "w-5 h-5" : "w-4 h-4";
  switch (props.issueStatus) {
    case IssueStatus.OPEN:
      if (props.taskStatus && props.taskStatus === Task_Status.FAILED) {
        return iconClass + " bg-error text-white";
      }
      return iconClass + " bg-white border-2 border-info text-info";
    case IssueStatus.CANCELED:
      return iconClass + " bg-white border-2 text-gray-400 border-gray-400";
    case IssueStatus.DONE:
      return (
        iconClass +
        " text-white" +
        (isUnfinishedResolvedIssue.value ? " bg-warning" : " bg-success")
      );
  }
};

const isUnfinishedResolvedIssue = computed(() => {
  return checkUnfinishedResolvedTask(props.issue);
});

const stringifyIssueStatus = (issueStatus: IssueStatus): string => {
  if (issueStatus === IssueStatus.OPEN) {
    return t("issue.table.open");
  } else if (issueStatus === IssueStatus.DONE) {
    return t("common.done");
  } else if (issueStatus === IssueStatus.CANCELED) {
    return t("common.canceled");
  }
  return "";
};
</script>
