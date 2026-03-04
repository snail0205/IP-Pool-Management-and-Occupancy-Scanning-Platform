# 使用方式：
# 1) 启动后端：npm run dev
# 2) 确认已有poolId（可先调用 /api/pools）

$base = "http://localhost:3000"
$poolId = 1

Write-Host "1) 创建任务（pending）"
$createBody = @{
  poolId = $poolId
  scopeType = "pool"
  scanMethod = "icmp_arp"
  frequencyType = "once"
  timeoutMs = 1200
  retryCount = 1
  concurrency = 20
  idempotencyKey = "demo-task-001"
} | ConvertTo-Json
$createResp = Invoke-RestMethod -Method Post -Uri "$base/api/scan/tasks" -ContentType "application/json" -Body $createBody
$taskId = $createResp.data.taskId
$createResp | ConvertTo-Json -Depth 6

Write-Host "2) 手动触发任务（running）"
Invoke-RestMethod -Method Post -Uri "$base/api/scan/tasks/$taskId/trigger" | ConvertTo-Json -Depth 6

Write-Host "3) 轮询任务进度"
for ($i = 0; $i -lt 10; $i++) {
  Start-Sleep -Seconds 1
  $progress = Invoke-RestMethod -Method Get -Uri "$base/api/scan/tasks/$taskId"
  $progress | ConvertTo-Json -Depth 6
  if ($progress.data.status -in @("success","failed","cancelled","paused")) { break }
}

Write-Host "4) 查询任务日志"
Invoke-RestMethod -Method Get -Uri "$base/api/scan/tasks/$taskId/logs?page=1&pageSize=20" | ConvertTo-Json -Depth 6

Write-Host "5) 导出日志CSV（输出前200字符）"
$csv = Invoke-WebRequest -Method Get -Uri "$base/api/scan/tasks/$taskId/logs/export"
$csv.Content.Substring(0, [Math]::Min(200, $csv.Content.Length))

Write-Host "6) 暂停/终止演示（重新建任务后执行）"
Write-Host "POST $base/api/scan/tasks/{taskId}/pause"
Write-Host "POST $base/api/scan/tasks/{taskId}/terminate"
