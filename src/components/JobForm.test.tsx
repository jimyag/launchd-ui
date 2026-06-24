import { beforeEach, describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { JobForm } from "@/components/JobForm"
import { resetFakeHandlers, setFakeHandler } from "@/test-utils/tauri-mock"
import type { LaunchdJob, PlistConfig } from "@/types"

const basePlist: PlistConfig = {
  label: "com.example.agent",
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
  throttle_interval: null,
  start_on_mount: true,
  watch_paths: null,
  queue_directories: null,
  process_type: "Background",
  nice: null,
  abandon_process_group: true,
  soft_resource_limits: null,
  hard_resource_limits: null,
  raw_xml: '<?xml version="1.0"?><plist version="1.0"><dict></dict></plist>',
}

function job(plist: Partial<PlistConfig> = {}): LaunchdJob {
  return {
    label: "com.example.agent",
    plist_path: "/Users/test/Library/LaunchAgents/com.example.agent.plist",
    source: "UserAgent",
    status: "Loaded",
    pid: null,
    last_exit_code: null,
    plist: {
      ...basePlist,
      ...plist,
    },
    last_run_at: null,
  }
}

beforeEach(() => {
  resetFakeHandlers()
})

describe("JobForm advanced configuration", () => {
  it("saves advanced structured fields", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <JobForm
        open={true}
        onClose={vi.fn()}
        onSave={onSave}
        editingJob={job()}
      />
    )

    await user.click(screen.getByRole("button", { name: /advanced configuration/i }))

    fireEvent.change(screen.getByLabelText(/environment variables/i), {
      target: { value: "FOO=bar\nPATH=/usr/bin" },
    })
    fireEvent.change(screen.getByLabelText(/root directory/i), {
      target: { value: "/var/empty" },
    })
    fireEvent.change(screen.getByLabelText(/umask/i), {
      target: { value: "022" },
    })
    fireEvent.change(screen.getByLabelText(/throttle interval/i), {
      target: { value: "0" },
    })
    fireEvent.change(screen.getByLabelText(/nice/i), {
      target: { value: "5" },
    })
    fireEvent.change(screen.getByLabelText(/watch paths/i), {
      target: { value: "/tmp/input\n\n/tmp/other" },
    })
    fireEvent.change(screen.getByLabelText(/queue directories/i), {
      target: { value: "/tmp/queue" },
    })

    const fileLimitInputs = screen.getAllByPlaceholderText("65536")
    fireEvent.change(fileLimitInputs[0], { target: { value: "2048" } })
    fireEvent.change(fileLimitInputs[1], { target: { value: "4096" } })

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [config, plistPath] = onSave.mock.calls[0]
    expect(plistPath).toBe("/Users/test/Library/LaunchAgents/com.example.agent.plist")
    expect(config).toMatchObject({
      environment_variables: {
        FOO: "bar",
        PATH: "/usr/bin",
      },
      root_directory: "/var/empty",
      umask: "022",
      throttle_interval: 0,
      watch_paths: ["/tmp/input", "/tmp/other"],
      queue_directories: ["/tmp/queue"],
      process_type: "Background",
      nice: 5,
      start_on_mount: true,
      abandon_process_group: true,
      soft_resource_limits: {
        number_of_files: 2048,
      },
      hard_resource_limits: {
        number_of_files: 4096,
      },
    })
  })

  it("drops invalid resource limit integers", async () => {
    const user = userEvent.setup()
    const onSave = vi.fn().mockResolvedValue(undefined)

    render(
      <JobForm
        open={true}
        onClose={vi.fn()}
        onSave={onSave}
        editingJob={job()}
      />
    )

    await user.click(screen.getByRole("button", { name: /advanced configuration/i }))

    const fileLimitInputs = screen.getAllByPlaceholderText("65536")
    fireEvent.change(fileLimitInputs[0], { target: { value: "1.5" } })
    fireEvent.change(fileLimitInputs[1], { target: { value: "abc" } })

    await user.click(screen.getByRole("button", { name: "Save" }))

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1))
    const [config] = onSave.mock.calls[0]
    expect(config.soft_resource_limits).toBeNull()
    expect(config.hard_resource_limits).toBeNull()
  })

  it("validates raw plist XML", async () => {
    const user = userEvent.setup()
    const validateRaw = vi.fn()
    setFakeHandler("validate_raw_plist", (args) => {
      validateRaw(args.xml)
      return undefined
    })

    render(
      <JobForm
        open={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        editingJob={job()}
      />
    )

    const advancedButton = screen.getByRole("button", { name: /advanced configuration/i })
    expect(advancedButton).toHaveAttribute("aria-expanded", "false")

    await user.click(advancedButton)

    expect(advancedButton).toHaveAttribute("aria-expanded", "true")
    const advancedPanelId = advancedButton.getAttribute("aria-controls")
    expect(advancedPanelId).toBeTruthy()
    expect(document.getElementById(advancedPanelId ?? "")).toBeInTheDocument()
    expect(screen.getByLabelText(/raw plist xml/i)).toHaveValue(basePlist.raw_xml)
    await user.click(screen.getByRole("button", { name: "Validate XML" }))

    expect(validateRaw).toHaveBeenCalledWith(basePlist.raw_xml)
    expect(await screen.findByRole("status")).toHaveTextContent("Raw plist is valid.")
  })

  it("validates before saving raw plist XML", async () => {
    const user = userEvent.setup()
    const onSaveRaw = vi.fn().mockResolvedValue(undefined)
    const validateRaw = vi.fn()
    setFakeHandler("validate_raw_plist", (args) => {
      validateRaw(args.xml)
      return undefined
    })

    render(
      <JobForm
        open={true}
        onClose={vi.fn()}
        onSave={vi.fn()}
        onSaveRaw={onSaveRaw}
        editingJob={job()}
      />
    )

    await user.click(screen.getByRole("button", { name: /advanced configuration/i }))
    fireEvent.change(screen.getByLabelText(/raw plist xml/i), {
      target: { value: "<plist><dict></dict></plist>" },
    })
    await user.click(screen.getByRole("button", { name: "Save Raw XML" }))

    await waitFor(() => expect(onSaveRaw).toHaveBeenCalledTimes(1))
    expect(validateRaw).toHaveBeenCalledWith("<plist><dict></dict></plist>")
    expect(onSaveRaw).toHaveBeenCalledWith(
      "/Users/test/Library/LaunchAgents/com.example.agent.plist",
      "<plist><dict></dict></plist>"
    )
  })
})
