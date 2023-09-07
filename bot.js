const { Client, GatewayIntentBits, REST, Routes } = require('discord.js')
const fs = require('fs')
require('dotenv').config()

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages]
})

const TOKEN = process.env.TOKEN
const GUILD_ID = process.env.GUILD_ID // To make the commands appear instantly

client.once('ready', async () => {
  console.log('Bot is online!')

  const commands = [
    {
      name: 'extract',
      description: 'Extracts data from messages based on parameters',
      options: [
        {
          name: 'channelsuffix',
          type: 3,
          description: 'The suffix for channels to search',
          required: true
        },
        {
          name: 'keys',
          type: 3,
          description: 'Comma-separated list of keys',
          required: true
        }
      ]
    }
  ]

  const rest = new REST({ version: '10' }).setToken(TOKEN)

  try {
    console.log('Started refreshing application (/) commands.')
    console.log(JSON.stringify(commands))
    console.log(JSON.stringify(commands[0].options))

    await rest.put(Routes.applicationGuildCommands(client.user.id, GUILD_ID), {
      body: commands
    })
    console.log('Successfully reloaded application (/) commands.')
  } catch (error) {
    console.error(error)
  }
})

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isCommand()) return

  const { commandName } = interaction

  if (commandName === 'extract') {
    try {
      const channelSuffix = interaction.options.getString('channelsuffix')
      const keysString = interaction.options.getString('keys')
      const keys = keysString.split(',').map((k) => k.trim())
      const results = [] // Declare results here

      const channels = interaction.guild.channels.cache.filter((channel) => {
        return channel.name.endsWith(channelSuffix)
      })

      for (const channel of channels.values()) {
        const messages = await fetchAllMessages(channel)
        for (const msg of messages) {
          let dataObject = {}
          for (const key of keys) {
            if (msg.content.includes(key)) {
              dataObject[key] = extractValueFromMessage(key, msg.content)
            }
          }
          if (Object.keys(dataObject).length) {
            results.push({
              user: msg.author.username,
              data: dataObject
            })
          }
        }
      }
      console.log('Results fetched:', results)
      outputResults(interaction, results, false)

      await interaction.reply('Data extraction complete.')
    } catch (error) {
      console.error('Error in handleExtractCommand:', error)
      await interaction.reply({
        content: 'An error occurred.',
        ephemeral: true
      })
    }
  }
})

async function fetchAllMessages(channel) {
  let allMessages = []
  let before = null

  try {
    while (true) {
      const messages = await channel.messages.fetch({ limit: 100, before })
      if (messages.size === 0) break

      allMessages.push(...messages.values())
      before = messages.last().id
    }
  } catch (error) {
    console.error(
      'Error fetching messages for channel',
      channel.name,
      ':',
      error
    )
  }

  return allMessages
}

function extractValueFromMessage(key, content) {
  const lines = content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(key)) {
      return lines[i + 1]?.trim()
    }
  }
}

function outputResults(message, results, asTxt) {
  const output = results
    .map((result) => `${result.user}: ${JSON.stringify(result.data)}`)
    .join('\n')

  try {
    if (!asTxt || output.length <= 2000) {
      message.channel.send(output)
    } else {
      fs.writeFileSync('results.txt', output)
      message.channel.send({ files: ['results.txt'] })
    }
  } catch (error) {
    console.error('Error outputting results:', error)
  }
}

client.login(TOKEN).catch((error) => console.error('Error logging in:', error))
