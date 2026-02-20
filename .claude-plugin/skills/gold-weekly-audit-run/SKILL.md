---
name: gold-weekly-audit-run
description: Execute weekly business audit and generate report
---

# Gold Weekly Audit Run

## Overview

The `gold.weekly-audit-run` skill executes a weekly business audit and generates a comprehensive report (the "Monday Morning CEO Briefing"). It collects financial, communication, productivity, and social data to provide insights and actionable recommendations for the user's business operations.

## Capabilities Configuration

**Parameters:**
- `week_date` (string, optional): Specific week to audit
- `report_format` (string, optional): Output format for the report (default: "md")
- `include_details` (boolean, optional): Include detailed analysis in report (default: true)

**Implementation Details:**
- `language`: javascript
- `handler`: runWeeklyAudit
- `dependencies`: `moment`, `fs-extra`

## When to use

Trigger this skill when:
- The user requests a weekly business audit or report.
- The user asks for the "Monday Morning CEO Briefing".
- Weekly reporting on financial stability, productivity trends, or social engagement is required.

## Resources

### scripts/
- `weekly_audit_run.js`: The core implementation of the audit task. It collects mocked data (financial, communication, productivity, social, tasks, documents), analyzes trends, and generates a markdown or configurable format report.

## Usage Instructions

This skill acts as an MCP server capability or a standalone script that can be utilized to gather metrics and synthesize a report. Claude can execute `scripts/weekly_audit_run.js` directly using Node.js or it can be attached to the MCP orchestrator.
