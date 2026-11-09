"""Offline browser checks. Run with the Python environment documented in README."""
import argparse
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

parser = argparse.ArgumentParser()
parser.add_argument("--channel", default="chrome")
args = parser.parse_args()
root = Path(__file__).resolve().parent.parent
artifacts = root / "artifacts"
artifacts.mkdir(exist_ok=True)
checks = []
errors = []
network = []

def check(name, condition):
    assert condition, name
    checks.append(name)

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, channel=args.channel or None)
    context = browser.new_context(viewport={"width": 1440, "height": 1000}, offline=True)
    page = context.new_page()
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.on("request", lambda request: network.append(request.url) if request.url.startswith(("http:", "https:")) else None)
    page.goto((root / "index.html").as_uri(), wait_until="networkidle")
    page.wait_for_function("window.RESEARCH_READY === true")
    check("离线单文件启动，不请求外部资源", not network)
    check("28 个故障条目已加载", page.locator("#case-list [data-case-option]").count() == 28)
    check("34 项来源已加载", page.locator("#source-list details").count() == 34)
    check("13 个架构组件已加载", page.locator("[data-node]").count() == 13)
    check("架构全景包含连接、状态与控制关系", page.locator(".architecture-svg .data-edge").count() >= 10
          and page.locator(".architecture-svg .state-edge").count() >= 5)
    check("故障全景包含触发、资源、影响与保护节点", page.locator("[data-fault-node]").count() == 20)
    page.screenshot(path=str(artifacts / "desktop-overview.png"))

    page.locator("#case-search").fill("这是不存在的故障关键字")
    check("搜索零结果有明确空态", "0 / 28" in page.locator("#case-count").inner_text())
    page.locator("#reset-filters").click()
    page.locator('#architecture-panorama [data-map-action="expand"]').click()
    check("架构图可进入全屏对话框", page.locator("#atlas-dialog").evaluate("(el)=>el.open"))
    page.locator('[data-atlas-node="gpu"]').click()
    check("全景节点联动组件解释", "整实例" in page.locator("#architecture-panorama-detail").inner_text())
    old_width = page.locator("#architecture-canvas").evaluate("(el)=>el.getBoundingClientRect().width")
    page.locator('#architecture-panorama [data-map-action="plus"]').click()
    check("全景放大改变真实图面尺寸", page.locator("#architecture-canvas").evaluate("(el)=>el.getBoundingClientRect().width") > old_width)
    page.keyboard.press("Escape")
    page.wait_for_function("""!document.querySelector('#atlas-dialog').open &&
      document.querySelector('#architecture-panorama').parentElement.id === 'architecture'""")
    check("退出全屏后图回原位置", not page.locator("#atlas-dialog").evaluate("(el)=>el.open")
          and page.locator("#architecture > #architecture-panorama").count() == 1)
    page.locator('#architecture-panorama [data-map-action="expand"]').click()
    page.locator('#architecture-panorama-detail [data-case="F07"]').click()
    page.wait_for_function("""!document.querySelector('#atlas-dialog').open &&
      document.querySelector('#architecture-panorama').parentElement.id === 'architecture'""")
    check("全屏图跳转处置会退出模态并定位故障", not page.locator("#atlas-dialog").evaluate("(el)=>el.open")
          and page.locator("#case-detail .case-id").inner_text() == "F07")
    page.locator('[data-fault-scene="cache"]').click()
    check("故障链选择突出缓存级联", page.locator(".fault-edge:not(.dim)").count() == 4)
    page.locator('[data-fault-guard="on"]').click()
    check("保护模式标注反馈切断点", page.locator(".fault-edge.feedback.blocked:not(.dim)").count() == 1)
    page.locator('[data-fault-scene="all"]').click()
    page.locator('[data-fault-guard="off"]').click()
    page.locator(".fault-matrix-expander > summary").click()
    check("故障全景矩阵覆盖全部条目", page.locator(".fault-matrix tbody tr").count() == 28)
    page.locator('.fault-matrix [data-case="F19"]').click()
    check("故障矩阵能定位完整恢复卡", page.locator("#case-detail .case-id").inner_text() == "F19")
    page.locator("#symptom-filter").select_option("contract")
    page.locator("#layer-filter").select_option("cache")
    check("症状与组件复合筛选", page.locator("#case-list [data-case-option]").count() == 1
          and page.locator("#case-detail").inner_text().startswith("F25"))
    page.locator("#reset-filters").click()
    page.locator('[data-node="vision"]').click()
    check("架构选择显示条件分支职责", "Vision Encoder" in page.locator("#node-detail").inner_text())
    page.locator('#node-detail [data-case="F27"]').click()
    check("架构可定位处置并清除旧筛选", page.locator("#case-detail .case-id").inner_text() == "F27"
          and page.locator("#case-list [data-case-option]").count() == 28)
    page.locator('[data-scenario="partial"]').click()
    check("生命周期切换改变机制说明", "再生成必须作为新候选" in page.locator("#scenario-panel").inner_text())
    page.locator('[data-scenario="queue"]').focus()
    page.keyboard.press("ArrowRight")
    check("场景支持键盘方向键", page.locator('[data-scenario="cold"]').get_attribute("aria-selected") == "true")

    page.locator('[data-lab="workload"]').click()
    page.locator("#slider-hit").evaluate("(el)=>{el.value=50;el.dispatchEvent(new Event('input',{bubbles:true}));}")
    check("缓存 90%→50% 工作量手算一致", page.locator("#lab-main-value").inner_text().replace(",", "").startswith("400000"))
    page.locator("#slider-seconds").evaluate("(el)=>{el.value=30;el.dispatchEvent(new Event('input',{bubbles:true}));}")
    check("Little 定律在途数手算一致", page.locator("#lab-concurrency").inner_text().replace(",", "") == "3000")
    page.locator('[data-lab="retry"]').click()
    check("单层独立重试手算一致", page.locator("#lab-main-value").inner_text().startswith("1.75"))
    page.locator("#slider-layers").evaluate("(el)=>{el.value=3;el.dispatchEvent(new Event('input',{bubbles:true}));}")
    check("三层最坏重试为 27 次而非平均值", page.locator("#retry-worst").inner_text() == "27")
    page.locator('[data-lab="capacity"]').click()
    page.locator("#slider-instances").evaluate("(el)=>{el.value=1;el.dispatchEvent(new Event('input',{bubbles:true}));}")
    check("N=1 边界明确无可服务实例", "没有可服务完整实例" in page.locator("#capacity-verdict").inner_text())
    page.locator("#slider-instances").evaluate("(el)=>{el.value=4;el.dispatchEvent(new Event('input',{bubbles:true}));}")

    page.locator('#case-detail a.ref[href="#source-S02"]').click()
    check("引用定位并展开来源", page.locator("#source-S02").get_attribute("open") is not None)
    page.locator("#source-search").fill("DualPipe")
    check("来源检索", page.locator("#source-list details").count() == 1)
    page.locator("#source-search").fill("")
    check("重置来源恢复完整登记", page.locator("#source-list details").count() == 34)
    check("全部外部来源使用 HTTPS", page.locator(".source-url").evaluate_all("(els)=>els.every(el=>el.href.startsWith('https://'))"))
    check("桌面页面无根级横向溢出", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))

    # Export actual connected diagrams as standalone, styled SVG and PNG files.
    page.evaluate("ResearchAtlas.selectNode('scheduler')")
    diagram_dir = root / "diagrams"
    diagram_dir.mkdir(exist_ok=True)
    for name, selector, height in [
        ("architecture-panorama", ".architecture-svg", 1000),
        ("failure-panorama", ".fault-svg", 1105)
    ]:
        svg = page.locator(selector).evaluate("""(el)=>{
          const copy=el.cloneNode(true);
          copy.setAttribute('xmlns','http://www.w3.org/2000/svg');
          copy.setAttribute('width','1360'); copy.setAttribute('height',el.viewBox.baseVal.height);
          const style=document.createElementNS('http://www.w3.org/2000/svg','style');
          style.textContent=document.querySelector('style').textContent;
          copy.insertBefore(style,copy.firstChild);
          return new XMLSerializer().serializeToString(copy);
        }""")
        (diagram_dir / f"{name}.svg").write_text(svg)
        export_page = context.new_page()
        export_page.set_viewport_size({"width": 1360, "height": height})
        export_page.set_content(f'<html><body style="margin:0">{svg}</body></html>')
        export_page.screenshot(path=str(diagram_dir / f"{name}.png"), full_page=True)
        export_page.close()
    check("两张全景图导出独立 SVG 与 PNG", all((diagram_dir / f"{name}.{extension}").exists()
          for name in ["architecture-panorama", "failure-panorama"] for extension in ["svg", "png"]))

    page.locator('[data-node="gpu"]').click()
    page.locator("#architecture").screenshot(path=str(artifacts / "desktop-architecture.png"))
    page.locator("#reset-filters").click()
    page.locator('[data-case-option="F07"]').click()
    page.locator("#incidents").screenshot(path=str(artifacts / "desktop-runbook.png"))
    all_case_ids = page.locator("#case-list [data-case-option]").evaluate_all("(els)=>els.map(el=>el.dataset.caseOption)")
    for case_id in all_case_ids:
        page.locator(f'[data-case-option="{case_id}"]').click()
        assert page.locator("#case-detail .case-id").inner_text() == case_id
        assert page.locator("#case-detail .case-checks li").count() >= 2
        assert page.locator("#case-detail .danger-note").inner_text().strip()
    check("全部 28 条处置可打开并包含恢复验收", True)

    page.set_viewport_size({"width": 390, "height": 844})
    page.evaluate("window.scrollTo(0,0)")
    page.screenshot(path=str(artifacts / "mobile-overview.png"))
    for lab in ["workload", "retry", "capacity"]:
        page.locator(f'[data-lab="{lab}"]').click()
        check(f"手机 {lab} 实验无横向溢出", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    page.locator("#reset-filters").click()
    page.locator('[data-case-option="F19"]').click()
    check("手机故障列表可选择工具处置", page.locator("#case-detail .case-id").inner_text() == "F19")
    page.locator("#incidents").screenshot(path=str(artifacts / "mobile-runbook.png"))
    check("手机页面无根级横向溢出", page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"))
    page.locator('#failure-panorama [data-map-action="expand"]').click()
    check("手机故障大图可全屏", page.locator("#atlas-dialog").evaluate("(el)=>el.open"))
    page.keyboard.press("Escape")
    page.wait_for_function("""!document.querySelector('#atlas-dialog').open &&
      document.querySelector('#failure-panorama').parentElement.id === 'incidents'""")
    page.keyboard.press("/")
    check("斜杠快捷键聚焦故障搜索", page.locator("#case-search").evaluate("(el)=>el===document.activeElement"))
    check("无 JavaScript 运行错误", not errors)

    # Deep-link entry is a separate page load, still with networking disabled.
    page.goto((root / "index.html").as_uri() + "?case=F20#incidents", wait_until="networkidle")
    page.wait_for_function("window.RESEARCH_READY === true")
    check("离线故障深链接可复现", page.locator("#case-detail .case-id").inner_text() == "F20")
    check("所有交互均无外部网络请求", not network)
    context.close()
    browser.close()

report = {"checks": checks, "passed": len(checks), "pageErrors": errors,
          "externalRequests": network, "browser": args.channel, "offline": True}
(artifacts / "browser-checks.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
print(json.dumps(report, ensure_ascii=False, indent=2))
