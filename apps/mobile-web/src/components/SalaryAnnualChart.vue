<script setup lang="ts">
import { BarChart } from 'echarts/charts';
import { GridComponent, TooltipComponent } from 'echarts/components';
import { init, use, type ECharts } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import type { SalaryAnnualSummary } from '../salary';

const props = defineProps<{ items: SalaryAnnualSummary['items'] }>();
const element = ref<HTMLElement>();
let chart: ECharts | undefined;
let resizeObserver: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;

use([BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function render() {
  if (!element.value) return;
  chart ??= init(element.value);
  chart.setOption(
    {
      animation: false,
      color: [token('--siyu-income')],
      grid: { top: 14, right: 8, bottom: 30, left: 50 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => `¥ ${(Number(value) / 100).toFixed(2)}`,
      },
      xAxis: {
        type: 'category',
        data: props.items.map((item) => `${Number(item.month.slice(-2))}月`),
        axisLabel: { color: token('--siyu-text-secondary'), interval: 1 },
        axisLine: { lineStyle: { color: token('--siyu-border') } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: token('--siyu-text-secondary'),
          formatter: (value: number) => `¥${Math.round(value / 100)}`,
        },
        splitLine: { lineStyle: { color: token('--siyu-border') } },
      },
      series: [
        {
          name: '实发工资',
          type: 'bar',
          data: props.items.map((item) => item.netCent),
          barMaxWidth: 18,
        },
      ],
    },
    true,
  );
}

watch(() => props.items, render, { deep: true });
onMounted(() => {
  render();
  if ('ResizeObserver' in window) {
    resizeObserver = new ResizeObserver(() => chart?.resize());
    resizeObserver.observe(element.value!);
  }
  themeObserver = new MutationObserver(render);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
});
onBeforeUnmount(() => {
  resizeObserver?.disconnect();
  themeObserver?.disconnect();
  chart?.dispose();
});
</script>

<template>
  <div ref="element" class="salary-chart" role="img" aria-label="年度每月实发工资柱状图"></div>
</template>

<style scoped>
.salary-chart {
  width: 100%;
  height: 220px;
}
</style>
