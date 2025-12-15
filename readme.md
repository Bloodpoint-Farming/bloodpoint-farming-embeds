# Bloodpoint Farming Embeds

This repo controls the embeds in static channels in https://discord.gg/bloodpoints such as #welcome, #rules, etc.

Changes are sync'd to discord on merge to main.

## Contributing

1. Fork the repo
2. Edit the JSON files (copy-paste them into discohook for previews)
3. Create a Pull Request

## Previewing Changes

Make sure your changes look good via either of the following methods.

### 1. PR Test Server

Pull requests automatically deploy to https://discord.gg/mk24G9YBuY. You can push changes to your PR branch and verify them in the server.

### 2. Your own test server and bot

1. Create your own discord server
2. Create your own bot at https://discord.com/developers/applications. Configure:
    - Installation
        - Installation Contexts
            - ✅ Guild Install
        - Default Install Settings
            - Scopes: `bot`
            - Permissions `Attach Files` `Embed Links` `Manage Messages` `Read Message History` `Send Messages` `View Channels`
3. Add the bot your server using the Installation > Install Link
4. Copy [.env](.env) to `.env.local`. Fill in your BOT_TOKEN (Bot > Reset Token) and GUILD_ID from your server in `.env.local`.
5. `npm sync`
