<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { connectWebSocket, addMessageHandler } from '$lib/stores/websocket';

  export let userId: string;

  const currentOperation = writable<any>(null);
  const isVisible = writable(false);

  const terminalStatuses = ['success', 'error', 'failed', 'warning', 'cancelled'];

  const clampPct = (v: any) => Math.max(0, Math.min(100, Number(v) || 0));

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return '#4CAF50';
      case 'error':
      case 'failed': return '#f44336';
      case 'warning': return '#ff9800';
      case 'cancelled': return '#9e9e9e';
      default: return '#2196F3';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✓';
      case 'error':
      case 'failed': return '✗';
      case 'warning': return '⚠';
      case 'cancelled': return '⏹';
      default: return '⟳';
    }
  };

  let cleanupHandlers: any[] = [];

  onMount(() => {
    console.log("🚀 EnhancedProgressBar monté avec userId =", userId);

    if (!userId) {
      console.error("❌ Pas de userId fourni à EnhancedProgressBar → WS pas démarré !");
      return;
    }

    connectWebSocket(userId);

    const scheduleHide = (ms: number) => {
      setTimeout(() => {
        currentOperation.set(null);
        isVisible.set(false);
      }, ms);
    };

    cleanupHandlers.push(
      addMessageHandler('progress_update', (data: any) => {
        currentOperation.set({ type: 'single', ...data });
        isVisible.set(true);
        if (terminalStatuses.includes(data.status)) scheduleHide(3000);
      }),

      addMessageHandler('enhanced_progress_update', (data: any) => {
        currentOperation.set({
          type: 'enhanced',
          ...data,
          poster_url: data.details?.poster_url
        });
        isVisible.set(true);
        if (terminalStatuses.includes(data.status)) scheduleHide(4000);
      }),

      addMessageHandler('bulk_operation_start', (data: any) => {
        currentOperation.set({ type: 'bulk', status: 'starting', overall_progress: 0, ...data });
        isVisible.set(true);
      }),

      addMessageHandler('bulk_operation_update', (data: any) => {
        const { total_items = 0, success_count = 0, failure_count = 0 } = data;
        let overall_progress = 0;
        if (total_items > 0) {
          overall_progress = Math.round(((success_count + failure_count) / total_items) * 100);
        }

        currentOperation.update(prev => ({
          ...prev,
          ...data,
          overall_progress
        }));
        isVisible.set(true);
      }),

      addMessageHandler('bulk_operation_complete', (data: any) => {
        currentOperation.update(prev => ({
          ...prev,
          ...data,
          overall_progress: 100,
          status: data.status ?? 'success'
        }));
        isVisible.set(true);
        scheduleHide(5000);
      }),

      addMessageHandler('clear_progress', (data: any) => {
        isVisible.set(false);
        currentOperation.set(null);
        if (data?.message) {
          currentOperation.set({
            type: 'cancelled',
            message: data.message,
            progress: 0,
            status: 'cancelled',
            timestamp: Date.now()
          });
          isVisible.set(true);
          scheduleHide(2000);
        }
      })
    );
  });

  onDestroy(() => {
    cleanupHandlers.forEach(fn => fn?.());
  });
</script>

<!-- Rendu -->
{#if $isVisible && $currentOperation}
  <div class="fixed bottom-4 right-4 z-50 w-96 max-w-full rounded-xl shadow-2xl overflow-hidden bg-neutral-900 border border-neutral-800">
    <div class="relative p-4">
      <div class="flex items-center gap-2">
        <span class="text-lg font-bold" style="color:{getStatusColor($currentOperation.status)}">
          {getStatusIcon($currentOperation.status)}
        </span>
        <span class="text-sm text-white truncate">{$currentOperation.message}</span>
      </div>

      <div class="mt-2 h-2 w-full bg-neutral-700 rounded overflow-hidden">
        <div
          class="h-2 transition-all duration-300"
          style="
            width: {clampPct(
              $currentOperation.type === 'bulk'
                ? ($currentOperation.overall_progress && $currentOperation.overall_progress > 0
                    ? $currentOperation.overall_progress
                    : $currentOperation.current_item_progress)
                : $currentOperation.progress
            )}%;
            background-color:{getStatusColor($currentOperation.status)};
          "
        ></div>
      </div>
    </div>
  </div>
{/if}
