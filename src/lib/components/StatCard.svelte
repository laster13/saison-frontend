<script lang="ts">export let label: string; export let value: number | string;</script>
<div class="card p-4">
  <div class="stat-number mb-1">{value}</div>
  <div class="stat-label">{label}</div>
</div>