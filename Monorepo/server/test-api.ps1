$ErrorActionPreference = "Continue"
$baseUrl = "http://localhost:3000"
$token = ""
$testPoolId = $null
$testBindingId = $null
$testTaskId = $null
$results = @()

function Api {
    param(
        [string]$Method,
        [string]$Path,
        [object]$Body = $null,
        [string]$Label,
        [switch]$NoAuth,
        [switch]$Raw
    )
    $url = "$baseUrl$Path"
    $headers = @{}
    if (-not $NoAuth -and $token) {
        $headers["Authorization"] = "Bearer $token"
    }
    try {
        $params = @{
            Uri = $url
            Method = $Method
            ContentType = "application/json"
            Headers = $headers
            ErrorAction = "Stop"
        }
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }
        $resp = Invoke-RestMethod @params
        if ($Raw) { return $resp }
        $code = if ($resp.code -ne $null) { $resp.code } else { "?" }
        $msg = if ($resp.message) { $resp.message } else { "ok" }
        $script:results += [PSCustomObject]@{Test=$Label; Status="PASS"; Code=$code; Message=$msg}
        Write-Host "[PASS] $Label  (code=$code)" -ForegroundColor Green
        return $resp
    } catch {
        $errMsg = $_.Exception.Message
        $statusCode = ""
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
        }
        $script:results += [PSCustomObject]@{Test=$Label; Status="FAIL"; Code=$statusCode; Message=$errMsg}
        Write-Host "[FAIL] $Label  ($statusCode) $errMsg" -ForegroundColor Red
        return $null
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  IP Pool Platform - Full API Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# ==================== 1. 健康检查 ====================
Write-Host "--- 1. Health Check ---" -ForegroundColor Yellow
Api -Method GET -Path "/health" -Label "Health Check" -NoAuth

# ==================== 2. 认证模块 ====================
Write-Host "`n--- 2. Auth Module ---" -ForegroundColor Yellow

# 2.1 登录（正确密码）
$loginResp = Api -Method POST -Path "/api/auth/login" -Body @{username="admin";password="123456"} -Label "Login (valid credentials)" -NoAuth
if ($loginResp -and $loginResp.data -and $loginResp.data.token) {
    $token = $loginResp.data.token
    Write-Host "   Token acquired: $($token.Substring(0,16))..." -ForegroundColor Gray
}

# 2.2 登录（错误密码）
Api -Method POST -Path "/api/auth/login" -Body @{username="admin";password="wrong"} -Label "Login (wrong password, expect fail)" -NoAuth

# 2.3 获取当前用户
Api -Method GET -Path "/api/auth/me" -Label "Get current user (GET /auth/me)"

# 2.4 用户列表
Api -Method GET -Path "/api/auth/users?page=1&pageSize=10" -Label "User list"

# ==================== 3. IP Pools CRUD ====================
Write-Host "`n--- 3. IP Pools CRUD ---" -ForegroundColor Yellow

# 3.1 查询现有池列表
$poolList = Api -Method GET -Path "/api/pools?page=1&pageSize=100" -Label "List all pools"

# 3.2 新建池（CIDR方式）
$createResp = Api -Method POST -Path "/api/pools" -Body @{
    name="TestPool-API-$(Get-Date -Format 'HHmmss')"
    cidr="10.99.0.0/28"
    networkType="IPv4"
    region="Test-Region"
    subnetMask="255.255.255.240"
    gateway="10.99.0.1"
    dns="8.8.8.8"
    leaseHours=24
    enabled=$true
} -Label "Create pool (CIDR 10.99.0.0/28)"

if ($createResp -and $createResp.data -and $createResp.data.id) {
    $testPoolId = $createResp.data.id
    Write-Host "   Created pool ID: $testPoolId" -ForegroundColor Gray
}

# 3.3 新建池（范围方式）
$createResp2 = Api -Method POST -Path "/api/pools" -Body @{
    name="TestPool-Range-$(Get-Date -Format 'HHmmss')"
    startIp="192.168.200.1"
    endIp="192.168.200.10"
    networkType="IPv4"
    region="Range-Region"
    enabled=$true
} -Label "Create pool (range 192.168.200.1-10)"

$testPoolId2 = $null
if ($createResp2 -and $createResp2.data -and $createResp2.data.id) {
    $testPoolId2 = $createResp2.data.id
    Write-Host "   Created pool ID: $testPoolId2" -ForegroundColor Gray
}

# 3.4 池详情
if ($testPoolId) {
    Api -Method GET -Path "/api/pools/$testPoolId" -Label "Get pool detail (id=$testPoolId)"
}

# 3.5 更新池
if ($testPoolId) {
    Api -Method PUT -Path "/api/pools/$testPoolId" -Body @{
        name="TestPool-Updated"
        region="Updated-Region"
    } -Label "Update pool name & region"
}

# 3.6 池统计
if ($testPoolId) {
    Api -Method GET -Path "/api/pools/$testPoolId/stats" -Label "Pool stats (id=$testPoolId)"
}

# 3.7 启用/禁用池
if ($testPoolId) {
    Api -Method PATCH -Path "/api/pools/$testPoolId/status" -Body @{enabled=$false} -Label "Disable pool"
    Api -Method PATCH -Path "/api/pools/$testPoolId/status" -Body @{enabled=$true} -Label "Re-enable pool"
}

# 3.8 池内 IP 列表
if ($testPoolId) {
    Api -Method GET -Path "/api/pools/$testPoolId/ips?page=1&pageSize=10" -Label "List IPs in pool"
}

# 3.9 关键字搜索池
Api -Method GET -Path "/api/pools?page=1&pageSize=10&keyword=Test" -Label "Search pools (keyword=Test)"

# ==================== 4. IP Bindings ====================
Write-Host "`n--- 4. IP Bindings ---" -ForegroundColor Yellow

if ($testPoolId) {
    # 4.1 创建绑定
    $bindResp = Api -Method POST -Path "/api/pools/$testPoolId/bindings" -Body @{
        ip="10.99.0.2"
        deviceName="TestServer01"
        department="IT"
        owner="tester"
        expectedMac="AA:BB:CC:DD:EE:01"
        purpose="API testing"
    } -Label "Create binding (10.99.0.2)"

    if ($bindResp -and $bindResp.data -and $bindResp.data.id) {
        $testBindingId = $bindResp.data.id
        Write-Host "   Created binding ID: $testBindingId" -ForegroundColor Gray
    }

    # 4.2 绑定列表
    Api -Method GET -Path "/api/pools/$testPoolId/bindings?page=1&pageSize=10" -Label "List bindings"

    # 4.3 更新绑定
    if ($testBindingId) {
        Api -Method PUT -Path "/api/pools/$testPoolId/bindings/$testBindingId" -Body @{
            ip="10.99.0.2"
            deviceName="TestServer01-Updated"
            department="IT-Updated"
            owner="tester2"
            expectedMac="AA:BB:CC:DD:EE:02"
            purpose="Updated purpose"
        } -Label "Update binding"
    }

    # 4.4 搜索绑定
    Api -Method GET -Path "/api/pools/$testPoolId/bindings?keyword=TestServer" -Label "Search bindings (keyword=TestServer)"

    # 4.5 解绑
    if ($testBindingId) {
        Api -Method POST -Path "/api/pools/$testPoolId/bindings/$testBindingId/unbind" -Label "Unbind"
    }
}

# ==================== 5. 扫描任务 ====================
Write-Host "`n--- 5. Scan Tasks ---" -ForegroundColor Yellow

# 5.1 创建扫描任务
if ($testPoolId) {
    $taskResp = Api -Method POST -Path "/api/scan/tasks" -Body @{
        poolId=$testPoolId
        scopeType="pool"
        scanMethod="icmp_arp"
        frequencyType="once"
        timeoutMs=3000
        retryCount=1
        concurrency=10
    } -Label "Create scan task (pool=$testPoolId)"

    if ($taskResp -and $taskResp.data -and $taskResp.data.id) {
        $testTaskId = $taskResp.data.id
        Write-Host "   Created task ID: $testTaskId" -ForegroundColor Gray
    }
}

# 5.2 任务列表
Api -Method GET -Path "/api/scan/tasks?page=1&pageSize=20" -Label "List scan tasks"

# 5.3 立即扫描
if ($testPoolId) {
    $scanResp = Api -Method POST -Path "/api/scan/$testPoolId/start" -Label "Immediate scan (pool=$testPoolId)"
    if ($scanResp -and $scanResp.data -and $scanResp.data.taskId) {
        $immTaskId = $scanResp.data.taskId
        Write-Host "   Immediate scan task ID: $immTaskId" -ForegroundColor Gray
    }
}

# 5.4 任务详情/进度
if ($testTaskId) {
    Api -Method GET -Path "/api/scan/tasks/$testTaskId" -Label "Task progress (id=$testTaskId)"
}

# 5.5 任务日志
if ($testTaskId) {
    Api -Method GET -Path "/api/scan/tasks/$testTaskId/logs?page=1&pageSize=10" -Label "Task logs"
}

# 5.6 最近失败任务
Api -Method GET -Path "/api/scan/tasks/failures/recent?limit=5" -Label "Recent failures"

# 5.7 按条件筛选任务
Api -Method GET -Path "/api/scan/tasks?page=1&pageSize=10&status=completed" -Label "Filter tasks (status=completed)"
Api -Method GET -Path "/api/scan/tasks?page=1&pageSize=10&frequencyType=once" -Label "Filter tasks (frequencyType=once)"

# ==================== 6. 占用率 ====================
Write-Host "`n--- 6. Occupancy ---" -ForegroundColor Yellow

# 6.1 占用率查询
Api -Method GET -Path "/api/occupancy?page=1&pageSize=10" -Label "Occupancy list"

# 6.2 按池筛选
if ($testPoolId) {
    Api -Method GET -Path "/api/occupancy?page=1&pageSize=10&poolId=$testPoolId" -Label "Occupancy by pool"
}

# 6.3 占用详情
if ($testPoolId) {
    Api -Method GET -Path "/api/occupancy/detail/$testPoolId/10.99.0.2" -Label "Occupancy detail (10.99.0.2)"
}

# 6.4 历史记录
Api -Method GET -Path "/api/occupancy/history?page=1&pageSize=10" -Label "Occupancy history"

# 6.5 占用报表
Api -Method GET -Path "/api/occupancy/report" -Label "Occupancy report (all)"

if ($testPoolId) {
    Api -Method GET -Path "/api/occupancy/report?poolId=$testPoolId" -Label "Occupancy report (pool=$testPoolId)"
}

# ==================== 7. 导出功能 ====================
Write-Host "`n--- 7. Export ---" -ForegroundColor Yellow

# 7.1 导出Excel
try {
    $headers = @{Authorization="Bearer $token"}
    $excelResp = Invoke-WebRequest -Uri "$baseUrl/api/occupancy/report/export/excel" -Method GET -Headers $headers -ErrorAction Stop
    $ct = $excelResp.Headers["Content-Type"]
    $len = $excelResp.Content.Length
    $results += [PSCustomObject]@{Test="Export Excel"; Status="PASS"; Code=200; Message="Content-Type=$ct, Size=${len}B"}
    Write-Host "[PASS] Export Excel  (Content-Type=$ct, Size=${len}B)" -ForegroundColor Green
} catch {
    $errMsg = $_.Exception.Message
    $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "?" }
    $results += [PSCustomObject]@{Test="Export Excel"; Status="FAIL"; Code=$statusCode; Message=$errMsg}
    Write-Host "[FAIL] Export Excel  ($statusCode) $errMsg" -ForegroundColor Red
}

# 7.2 导出PDF
try {
    $headers = @{Authorization="Bearer $token"}
    $pdfResp = Invoke-WebRequest -Uri "$baseUrl/api/occupancy/report/export/pdf" -Method GET -Headers $headers -ErrorAction Stop
    $ct = $pdfResp.Headers["Content-Type"]
    $len = $pdfResp.Content.Length
    $results += [PSCustomObject]@{Test="Export PDF"; Status="PASS"; Code=200; Message="Content-Type=$ct, Size=${len}B"}
    Write-Host "[PASS] Export PDF  (Content-Type=$ct, Size=${len}B)" -ForegroundColor Green
} catch {
    $errMsg = $_.Exception.Message
    $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "?" }
    $results += [PSCustomObject]@{Test="Export PDF"; Status="FAIL"; Code=$statusCode; Message=$errMsg}
    Write-Host "[FAIL] Export PDF  ($statusCode) $errMsg" -ForegroundColor Red
}

# 7.3 导出任务日志 CSV
if ($testTaskId) {
    try {
        $headers = @{Authorization="Bearer $token"}
        $csvResp = Invoke-WebRequest -Uri "$baseUrl/api/scan/tasks/$testTaskId/logs/export" -Method GET -Headers $headers -ErrorAction Stop
        $ct = $csvResp.Headers["Content-Type"]
        $len = $csvResp.Content.Length
        $results += [PSCustomObject]@{Test="Export Task Log CSV"; Status="PASS"; Code=200; Message="Content-Type=$ct, Size=${len}B"}
        Write-Host "[PASS] Export Task Log CSV  (Content-Type=$ct, Size=${len}B)" -ForegroundColor Green
    } catch {
        $errMsg = $_.Exception.Message
        $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "?" }
        $results += [PSCustomObject]@{Test="Export Task Log CSV"; Status="FAIL"; Code=$statusCode; Message=$errMsg}
        Write-Host "[FAIL] Export Task Log CSV  ($statusCode) $errMsg" -ForegroundColor Red
    }
}

# ==================== 8. 系统设置 ====================
Write-Host "`n--- 8. System Settings ---" -ForegroundColor Yellow

Api -Method GET -Path "/api/system/settings" -Label "Get system settings"

Api -Method PUT -Path "/api/system/settings" -Body @{
    scanDefaultConcurrency=20
    scanDefaultTimeoutMs=5000
    scanDefaultRetryCount=2
    dashboardAutoRefreshSec=30
    taskListAutoRefreshSec=15
    enableTaskFailureAlert=$true
} -Label "Update system settings"

Api -Method GET -Path "/api/system/settings" -Label "Verify settings updated"

# ==================== 9. 清理测试数据 ====================
Write-Host "`n--- 9. Cleanup ---" -ForegroundColor Yellow

if ($testPoolId2) {
    Api -Method DELETE -Path "/api/pools/$testPoolId2" -Label "Delete range pool (id=$testPoolId2)"
}
if ($testPoolId) {
    Api -Method DELETE -Path "/api/pools/$testPoolId" -Label "Delete CIDR pool (id=$testPoolId)"
}

# ==================== 10. 认证边界测试 ====================
Write-Host "`n--- 10. Auth Edge Cases ---" -ForegroundColor Yellow

# 无token请求
try {
    $resp = Invoke-RestMethod -Uri "$baseUrl/api/pools" -Method GET -ContentType "application/json" -ErrorAction Stop
    $results += [PSCustomObject]@{Test="No token (expect 401)"; Status="FAIL"; Code="200?"; Message="Should have rejected"}
    Write-Host "[FAIL] No token (expect 401) - Should have been rejected" -ForegroundColor Red
} catch {
    $statusCode = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { "?" }
    if ($statusCode -eq 401) {
        $results += [PSCustomObject]@{Test="No token (expect 401)"; Status="PASS"; Code=401; Message="Correctly rejected"}
        Write-Host "[PASS] No token (expect 401)  - Correctly rejected" -ForegroundColor Green
    } else {
        $results += [PSCustomObject]@{Test="No token (expect 401)"; Status="FAIL"; Code=$statusCode; Message=$_.Exception.Message}
        Write-Host "[FAIL] No token - Unexpected status $statusCode" -ForegroundColor Red
    }
}

# ==================== 11. 登出 ====================
Write-Host "`n--- 11. Logout ---" -ForegroundColor Yellow
Api -Method POST -Path "/api/auth/logout" -Label "Logout"

# ==================== SUMMARY ====================
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  TEST SUMMARY" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$pass = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$fail = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$total = $results.Count

Write-Host "`nTotal: $total   Pass: $pass   Fail: $fail" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($fail -gt 0) {
    Write-Host "Failed tests:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "  [FAIL] $($_.Test) - Code:$($_.Code) $($_.Message)" -ForegroundColor Red
    }
}

Write-Host "`nAll results:" -ForegroundColor Gray
$results | Format-Table -AutoSize
