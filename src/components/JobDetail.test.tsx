import { beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { JobDetail } from "@/components/JobDetail"
import { resetFakeHandlers, setFakeHandler } from "@/test-utils/tauri-mock"
import type { LaunchdJob, PlistConfig } from "@/types"

const plist: PlistConfig = {
  label: "com.example.detail",
  program: "/usr/bin/true",
  program_arguments: ["/usr/bin/true"],
  run_at_load: true,
  keep_alive: false,
  start_interval: null,
  start_calendar_interval: null,
  standard_out_path: null,
  standard_error_path: null,
  working_directory: null,
  environment_variables: null,
  disabled: false,
  wake_system: false,
  root_directory: null,
  umask: null,
  throttle_interval: 0,
  start_on_mount: false,
  watch_paths: ["/tmp/input", "/tmp/other"],
  queue_directories: ["/tmp/queue", "/tmp/ready"],
  process_type: null,
  nice: null,
  abandon_process_group: false,
  soft_resource_limits: {
    core: null,
    cpu: 10,
    data: null,
    file_size: null,
    memory_lock: null,
    number_of_files: 2048,
    number_of_processes: null,
    resident_set_size: null,
    stack: null,
  },
  hard_resource_limits: null,
  raw_xml: '<?xml version="1.0"?><plist version="1.0"><dict></dict></plist>',
}

function job(): LaunchdJob {
  return {
    label: "com.example.detail",
    plist_path: "/Users/test/Library/LaunchAgents/com.example.detail.plist",
    source: "UserAgent",
    status: "Loaded",
    pid: null,
    last_exit_code: null,
    plist,
    last_run_at: null,
  }
}

beforeEach(() => {
  resetFakeHandlers()
})

describe("JobDetail advanced configuration", () => {
  it("shows zero throttle and comma-separated advanced values", async () => {
    setFakeHandler("get_job_detail", () => job())

    render(
      <JobDetail
        plistPath="/Users/test/Library/LaunchAgents/com.example.detail.plist"
        open={true}
        onClose={vi.fn()}
        onEdit={vi.fn()}
      />
    )

    expect(
      await screen.findByRole("heading", { name: "com.example.detail" })
    ).toBeInTheDocument()
    expect(screen.getByText("0s")).toBeInTheDocument()
    expect(screen.getByText("/tmp/input, /tmp/other")).toBeInTheDocument()
    expect(screen.getByText("/tmp/queue, /tmp/ready")).toBeInTheDocument()
    expect(screen.getByText("CPU=10, NumberOfFiles=2048")).toBeInTheDocument()
  })
})
