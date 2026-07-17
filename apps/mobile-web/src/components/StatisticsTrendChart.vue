<script setup lang="ts">
import { BarChart } from 'echarts/charts';
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import { init, use, type ECharts } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

import type { StatisticsTrendItem } from '../statistics';

const props = defineProps<{ items: StatisticsTrendItem[] }>();
const chartElement = ref<HTMLElement>();
let chart: ECharts | undefined;
let resizeObserver: ResizeObserver | undefined;
let themeObserver: MutationObserver | undefined;

use([BarChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

function cssToken(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function render(): void {
  if (!chartElement.value) return;
  chart ??= init(chartElement.value);
  chart.setOption(
    {
      animation: false,
      color: [cssToken('--siyu-expense'), cssToken('--siyu-income')],
      grid: { top: 18, right: 8, bottom: 28, left: 48 },
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => `¥ ${(Number(value) / 100).toFixed(2)}`,
      },
      legend: { data: ['支出', '收入'], textStyle: { color: cssToken('--siyu-text-secondary') } },
      xAxis: {
        type: 'category',
        data: props.items.map((item) => String(Number(item.date.slice(-2)))),
        axisLabel: { color: cssToken('--siyu-text-secondary'), interval: 4 },
        axisLine: { lineStyle: { color: cssToken('--siyu-border') } },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          color: cssToken('--siyu-text-secondary'),
          formatter: (value: number) => `¥${Math.round(value / 100)}`,
        },
        splitLine: { lineStyle: { color: cssToken('--siyu-border') } },
      },
      series: [
        {
          name: '支出',
          type: 'bar',
          data: props.items.map((item) => item.expenseCent),
          barMaxWidth: 9,
        },
        {
          name: '收入',
          type: 'bar',
          data: props.items.map((item) => item.incomeCent),
          barMaxWidth: 9,
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
    resizeObserver.observe(chartElement.value!);
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
  <div
    ref="chartElement"
    class="trend-chart"
    role="img"
    aria-label="本月每日收入与支出趋势图"
  ></div>
</template>

<style scoped>
.trend-chart {
  width: 100%;
  height: 220px;
}
</style>
