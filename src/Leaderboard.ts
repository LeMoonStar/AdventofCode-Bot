import {
  Message,
  MessageEmbed,
  GuildChannel,
  TextChannel,
  Collection,
} from 'discord.js';
import DiscordBot from './DiscordBot';
import { request } from 'https';
import { IncomingMessage } from 'http';

interface Member {
  last_star_ts: number;
  local_score: number;
  stars: number;
  name: string;
}

export default class Leaderboard {
  private _messages: Message[] = [];
  private _leaderboardChannel: TextChannel;

  onReady(): void {
    // get all guilds the bot is on
    for (const guild of DiscordBot._client.guilds.cache.array()) {
      // check if these guilds have a text channel named 'leaderboard'
      const leaderboardChannel = guild.channels.cache
        .array()
        .find(
          (channel: GuildChannel) =>
            channel.name === 'leaderboard' && channel.type === 'text'
        );
      if (!leaderboardChannel || !(leaderboardChannel instanceof TextChannel))
        continue;

      this._leaderboardChannel = leaderboardChannel;

      // get the latest message in the channel and check if it originated from this bot
      this._leaderboardChannel.messages
        .fetch({ limit: 1 })
        .then(this.messagesFetched.bind(this))
        .catch(console.error);
    }
  }

  private messagesFetched(messages: Collection<string, Message>): void {
    const now: Date = new Date();
    if (messages.first() && messages.first().member.user === DiscordBot._client.user)
      // add to messages array
      this._messages.push(messages.first());
    else {
      // create message and add to messages array
      this._leaderboardChannel
        .send(
          new MessageEmbed()
            .setColor('#0f0f23')
            .setTitle(`Advent Of Code ${now.getFullYear()} Leaderboard`)
            .setURL(
              `https://adventofcode.com/${now.getFullYear()}/leaderboard/private/view/${
                process.env.LEADERBOARD_ID
              }`
            )
            .setDescription('FIRST TIME SETUP...')
            .setTimestamp(now)
        )
        .then((message: Message) => this._messages.push(message))
        .catch(console.error);
    }

    // update Leaderbaord the first time
    this.updateLeaderboard();
  }

  private updateLeaderboard(): void {
    // re-call this function in 30 minutes
    setTimeout(
      this.updateLeaderboard.bind(this),
      1800000 //30 minutes
    );

    const now = new Date();

    console.log(`${now}: refreshing Leaderboard`);

    // fetch API
   request(
      {
        host: 'adventofcode.com',
        path: `/${now.getFullYear()}/leaderboard/private/view/${
          process.env.LEADERBOARD_ID
        }.json`,
        headers: { Cookie: `session=${process.env.AOC_SESSION}` },
      },
      (res: IncomingMessage) => {
        // wait for data
        res.on('data', this.dataReceived.bind(this));
      }
    )
      .on('error', console.error)
      .end();
  }

  private dataReceived(data: string): void {
    const now = new Date();
    const nextUpdate = new Date(now.getTime() + 1800000);
    let leaderboardData: { members: Member[] } = JSON.parse(data);

    let newMsg: MessageEmbed = new MessageEmbed()
      .setColor('#0f0f23')
      .setTitle(`Advent Of Code ${now.getFullYear()} - Leaderboard`)
      .setURL(
        `https://adventofcode.com/${nextUpdate.getFullYear()}/leaderboard/private/view/${
          process.env.LEADERBOARD_ID
        }`
      )
      .setDescription(`Next update: ${nextUpdate.toLocaleTimeString()}`)
      .setTimestamp(now);

    // convert from object to array
    let members: Member[] = Object.values(leaderboardData.members);

    // sort based on local score
    members.sort((a: Member, b: Member): number => b.local_score - a.local_score);

    // add members to embed
    for (const member of members) {
      let stars = '';
      for (let i = 0; i < Math.floor(member.stars / 2); i++) stars += ':star:';
      if (member.stars % 2) stars += ':last_quarter_moon:';
      for (let i = Math.round(member.stars / 2); i < 24; i++)
        stars += ':new_moon:';

      newMsg.addField(member.name, stars);
    }

    // update all leaderbaord messages
    for (const msg of this._messages) msg.edit(newMsg).catch(console.error);
  }
}
