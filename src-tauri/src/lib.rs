use tauri::{WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;
use tokio::net::TcpStream;
use tokio::time::{sleep, timeout, Duration, Instant};

const WORKER_HOST: &str = "127.0.0.1";
const WORKER_PORT: u16 = 37777;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(20);
const POLL_INTERVAL: Duration = Duration::from_millis(250);
const CONNECT_TIMEOUT: Duration = Duration::from_millis(500);

async fn worker_alive() -> bool {
    matches!(
        timeout(CONNECT_TIMEOUT, TcpStream::connect((WORKER_HOST, WORKER_PORT))).await,
        Ok(Ok(_))
    )
}

async fn wait_for_worker() -> bool {
    let deadline = Instant::now() + HEALTH_TIMEOUT;
    while Instant::now() < deadline {
        if worker_alive().await {
            return true;
        }
        sleep(POLL_INTERVAL).await;
    }
    false
}

async fn ensure_worker(app_handle: &tauri::AppHandle) {
    if worker_alive().await {
        log::info!("Worker already running on :{WORKER_PORT}, attaching");
    } else {
        log::info!("Worker not running on :{WORKER_PORT}, spawning sidecar");
        match app_handle.shell().sidecar("claude-mem-worker") {
            Ok(cmd) => match cmd.args(["--daemon"]).spawn() {
                Ok((mut rx, _child)) => {
                    log::info!("Sidecar spawned");
                    tauri::async_runtime::spawn(async move {
                        while let Some(event) = rx.recv().await {
                            match event {
                                CommandEvent::Stdout(line) => log::info!(
                                    "[worker] {}",
                                    String::from_utf8_lossy(&line).trim_end()
                                ),
                                CommandEvent::Stderr(line) => log::warn!(
                                    "[worker] {}",
                                    String::from_utf8_lossy(&line).trim_end()
                                ),
                                _ => {}
                            }
                        }
                    });
                }
                Err(e) => log::error!("Failed to spawn sidecar: {e}"),
            },
            Err(e) => log::warn!("Sidecar binary unavailable (dev mode without compiled worker?): {e}"),
        }
    }

    if !wait_for_worker().await {
        log::warn!(
            "Worker not healthy within {}s — opening window anyway",
            HEALTH_TIMEOUT.as_secs()
        );
    }
}

fn open_main_window(app_handle: &tauri::AppHandle) {
    let url = format!("http://localhost:{WORKER_PORT}");
    let parsed = match url.parse() {
        Ok(u) => u,
        Err(e) => {
            log::error!("Failed to parse worker URL: {e}");
            return;
        }
    };

    let result = WebviewWindowBuilder::new(app_handle, "main", WebviewUrl::External(parsed))
        .title("Claude-Mem")
        .inner_size(1400.0, 900.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .build();

    if let Err(e) = result {
        log::error!("Failed to create main window: {e}");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                ensure_worker(&app_handle).await;
                open_main_window(&app_handle);
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
