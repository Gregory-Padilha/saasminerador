import pdb

import pyperclip
from typing import Optional, Type, Callable, Dict, Any, Union, Awaitable, TypeVar
from pydantic import BaseModel
from browser_use.agent.views import ActionResult
from browser_use.browser.context import BrowserContext
from browser_use.controller.service import Controller, DoneAction
from browser_use.controller.registry.service import Registry, RegisteredAction
from main_content_extractor import MainContentExtractor
from browser_use.controller.views import (
    ClickElementAction,
    DoneAction,
    ExtractPageContentAction,
    GoToUrlAction,
    InputTextAction,
    OpenTabAction,
    ScrollAction,
    SearchGoogleAction,
    SendKeysAction,
    SwitchTabAction,
)
import logging
import inspect
import asyncio
import os
from langchain_core.language_models.chat_models import BaseChatModel
from browser_use.agent.views import ActionModel, ActionResult

from src.utils.mcp_client import create_tool_param_model, setup_mcp_client_and_tools

from browser_use.utils import time_execution_sync

logger = logging.getLogger(__name__)

Context = TypeVar('Context')


class CustomController(Controller):
    def __init__(self, exclude_actions: list[str] = [],
                 output_model: Optional[Type[BaseModel]] = None,
                 ask_assistant_callback: Optional[Union[Callable[[str, BrowserContext], Dict[str, Any]], Callable[
                     [str, BrowserContext], Awaitable[Dict[str, Any]]]]] = None,
                 ):
        super().__init__(exclude_actions=exclude_actions, output_model=output_model)
        self._register_custom_actions()
        self.ask_assistant_callback = ask_assistant_callback
        self.mcp_client = None
        self.mcp_server_config = None

    def _register_custom_actions(self):
        """Register all custom browser actions"""

        @self.registry.action(
            "When executing tasks, prioritize autonomous completion. However, if you encounter a definitive blocker "
            "that prevents you from proceeding independently – such as needing credentials you don't possess, "
            "requiring subjective human judgment, needing a physical action performed, encountering complex CAPTCHAs, "
            "or facing limitations in your capabilities – you must request human assistance."
        )
        async def ask_for_assistant(query: str, browser: BrowserContext):
            if self.ask_assistant_callback:
                if inspect.iscoroutinefunction(self.ask_assistant_callback):
                    user_response = await self.ask_assistant_callback(query, browser)
                else:
                    user_response = self.ask_assistant_callback(query, browser)
                msg = f"AI ask: {query}. User response: {user_response['response']}"
                logger.info(msg)
                return ActionResult(extracted_content=msg, include_in_memory=True)
            else:
                return ActionResult(extracted_content="Human cannot help you. Please try another way.",
                                    include_in_memory=True)

        @self.registry.action(
            'Upload file to interactive element with file path ',
        )
        async def upload_file(index: int, path: str, browser: BrowserContext, available_file_paths: list[str]):
            if path not in available_file_paths:
                return ActionResult(error=f'File path {path} is not available')

            if not os.path.exists(path):
                return ActionResult(error=f'File {path} does not exist')

            dom_el = await browser.get_dom_element_by_index(index)

            file_upload_dom_el = dom_el.get_file_upload_element()

            if file_upload_dom_el is None:
                msg = f'No file upload element found at index {index}'
                logger.info(msg)
                return ActionResult(error=msg)

            file_upload_el = await browser.get_locate_element(file_upload_dom_el)

            if file_upload_el is None:
                msg = f'No file upload element found at index {index}'
                logger.info(msg)
                return ActionResult(error=msg)

            try:
                await file_upload_el.set_input_files(path)
                msg = f'Successfully uploaded file to index {index}'
                logger.info(msg)
                return ActionResult(extracted_content=msg, include_in_memory=True)
            except Exception as e:
                msg = f'Failed to upload file to index {index}: {str(e)}'
                logger.info(msg)
                return ActionResult(error=msg)

        @self.registry.action(
            "Save a newly mined digital offer directly into the Offer Miner database. "
            "Call this whenever you find a valid low-ticket offer with name, landing page, price, etc. "
            "It will automatically generate an Approval Card in the SaaS for the user to review."
        )
        async def save_offer_to_miner_database(
            product_name: str,
            advertiser: str,
            landing_page_url: Optional[str] = None,
            price: Optional[float] = None,
            meta_ads_url: Optional[str] = None,
            checkout_url: Optional[str] = None,
            niche: Optional[str] = None,
            headline: Optional[str] = None,
            promise: Optional[str] = None,
            active_ads_count: Optional[int] = None,
        ):
            import urllib.request
            import json
            endpoint = os.environ.get("OFFER_MINER_STAGE_URL", "http://127.0.0.1:3000/api/agent/stage")
            payload = {
                "product_name": product_name,
                "advertiser": advertiser,
                "landing_page_url": landing_page_url,
                "price": price,
                "meta_ads_url": meta_ads_url,
                "checkout_url": checkout_url,
                "niche": niche,
                "headline": headline,
                "promise": promise,
                "active_ads_count": active_ads_count,
            }
            try:
                req = urllib.request.Request(
                    endpoint,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST",
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    res_body = json.loads(response.read().decode("utf-8"))
                    msg = f"Offer Miner: {res_body.get('message', 'Oferta enviada para o Card de Aprovação no SaaS!')}"
                    logger.info(msg)

                    # Update live activity tracker
                    try:
                        act_url = os.environ.get("OFFER_MINER_ACTIVITY_URL", "http://127.0.0.1:3000/api/agent/activity")
                        act_req = urllib.request.Request(
                            act_url,
                            data=json.dumps({
                                "status": "RUNNING",
                                "last_action": f"Nova oferta: '{product_name}'",
                                "next_goal": f"Oferta '{product_name}' enviada para aprovação. Continuando varredura...",
                            }).encode("utf-8"),
                            headers={"Content-Type": "application/json"},
                            method="POST",
                        )
                        urllib.request.urlopen(act_req, timeout=1.5)
                    except Exception:
                        pass

                    return ActionResult(extracted_content=msg, include_in_memory=True)
            except Exception as e:
                logger.error(f"Failed to stage offer to Offer Miner: {e}")
                return ActionResult(error=f"Could not stage to Offer Miner: {str(e)}")

        @self.registry.action(
            "Check if an offer, landing page URL, or Meta Ad ID is already in the Offer Miner database before mining it."
        )
        async def check_duplicate_in_offer_miner(
            url: Optional[str] = None,
            product_name: Optional[str] = None,
            meta_ad_id: Optional[str] = None,
        ):
            import urllib.request
            import urllib.parse
            import json
            base_url = os.environ.get("OFFER_MINER_CHECK_URL", "http://127.0.0.1:3000/api/agent/check-duplicate")
            params = {}
            if url:
                params["url"] = url
            if product_name:
                params["name"] = product_name
            if meta_ad_id:
                params["metaAdId"] = meta_ad_id

            if not params:
                return ActionResult(extracted_content="No parameters provided for duplicate check.")

            qs = urllib.parse.urlencode(params)
            full_url = f"{base_url}?{qs}"
            try:
                with urllib.request.urlopen(full_url, timeout=5) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    if data.get("isDuplicate"):
                        return ActionResult(
                            extracted_content=f"DUPLICATE DETECTED in Offer Miner: {data.get('matchReason')}. Skip this offer.",
                            include_in_memory=True,
                        )
                    else:
                        return ActionResult(
                            extracted_content="Offer NOT in Offer Miner database. It is a new offer, proceed with mining.",
                            include_in_memory=True,
                        )
            except Exception as e:
                logger.warning(f"Duplicate check failed: {e}")
                return ActionResult(extracted_content=f"Duplicate check error: {str(e)}. Proceed with care.")

        @self.registry.action(
            "Fetch the current Offer Miner catalog summary, including known domains and offer counts."
        )
        async def get_offer_miner_catalog_summary():
            import urllib.request
            import json
            endpoint = os.environ.get("OFFER_MINER_CATALOG_URL", "http://127.0.0.1:3000/api/agent/catalog")
            try:
                with urllib.request.urlopen(endpoint, timeout=5) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    domains = data.get("knownDomains", [])[:8]
                    summary = f"Offer Miner: {data.get('total')} offers tracked across {data.get('knownDomainsCount')} domains. Sample domains: {', '.join(domains)}"
                    return ActionResult(extracted_content=summary, include_in_memory=True)
            except Exception as e:
                return ActionResult(error=f"Could not fetch catalog: {str(e)}")

    @time_execution_sync('--act')
    async def act(
            self,
            action: ActionModel,
            browser_context: Optional[BrowserContext] = None,
            #
            page_extraction_llm: Optional[BaseChatModel] = None,
            sensitive_data: Optional[Dict[str, str]] = None,
            available_file_paths: Optional[list[str]] = None,
            #
            context: Context | None = None,
    ) -> ActionResult:
        """Execute an action"""

        try:
            for action_name, params in action.model_dump(exclude_unset=True).items():
                if params is not None:
                    if action_name.startswith("mcp"):
                        # this is a mcp tool
                        logger.debug(f"Invoke MCP tool: {action_name}")
                        mcp_tool = self.registry.registry.actions.get(action_name).function
                        result = await mcp_tool.ainvoke(params)
                    else:
                        result = await self.registry.execute_action(
                            action_name,
                            params,
                            browser=browser_context,
                            page_extraction_llm=page_extraction_llm,
                            sensitive_data=sensitive_data,
                            available_file_paths=available_file_paths,
                            context=context,
                        )

                    if isinstance(result, str):
                        return ActionResult(extracted_content=result)
                    elif isinstance(result, ActionResult):
                        return result
                    elif result is None:
                        return ActionResult()
                    else:
                        raise ValueError(f'Invalid action result type: {type(result)} of {result}')
            return ActionResult()
        except Exception as e:
            raise e

    async def setup_mcp_client(self, mcp_server_config: Optional[Dict[str, Any]] = None):
        self.mcp_server_config = mcp_server_config
        if self.mcp_server_config:
            self.mcp_client = await setup_mcp_client_and_tools(self.mcp_server_config)
            self.register_mcp_tools()

    def register_mcp_tools(self):
        """
        Register the MCP tools used by this controller.
        """
        if self.mcp_client:
            for server_name in self.mcp_client.server_name_to_tools:
                for tool in self.mcp_client.server_name_to_tools[server_name]:
                    tool_name = f"mcp.{server_name}.{tool.name}"
                    self.registry.registry.actions[tool_name] = RegisteredAction(
                        name=tool_name,
                        description=tool.description,
                        function=tool,
                        param_model=create_tool_param_model(tool),
                    )
                    logger.info(f"Add mcp tool: {tool_name}")
                logger.debug(
                    f"Registered {len(self.mcp_client.server_name_to_tools[server_name])} mcp tools for {server_name}")
        else:
            logger.warning(f"MCP client not started.")

    async def close_mcp_client(self):
        if self.mcp_client:
            await self.mcp_client.__aexit__(None, None, None)
