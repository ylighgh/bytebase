<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <h3 class="text-base font-medium">
        {{ $t("common.activity") }}
      </h3>
    </div>
    <IssueCommentList />
  </div>
</template>

<script setup lang="ts">
import IssueCommentList from "@/components/IssueV1/components/IssueCommentSection/IssueCommentList.vue";
</script>
