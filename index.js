const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const express = require('express');
const config = require('./config.json');

// --- 1. WEBOVÝ SERVER (zabezpečí, že Render bota neuspí) ---
const app = express();
const port = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Pohodari Bot beží na 100%!');
});

app.listen(port, () => {
    console.log(`Web server počúva na porte ${port}`);
});

// --- 2. DISCORD BOT ---
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on('ready', async () => {
    console.log(`Bot je prihlásený ako ${client.user.tag}!`);

    const channel = client.channels.cache.find(ch => ch.name === 'kalkulacka');
    if (channel) {
        try {
            const messages = await channel.messages.fetch({ limit: 10 });
            await channel.bulkDelete(messages).catch(() => {});

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('btn_fixboxy')
                        .setLabel('⚙️ FIXBOXY (VÝROBA)')
                        .setStyle(ButtonStyle.Success),
                    new ButtonBuilder()
                        .setCustomId('btn_weed')
                        .setLabel('🌿 WEED BAGS (PRODUKCIA)')
                        .setStyle(ButtonStyle.Primary)
                );

            const embed = new EmbedBuilder()
                .setColor('#5865F2')
                .setTitle('📊 POHODÁRI • EKONOMICKÁ KALKULAČKA')
                .setDescription('Kliknutím na tlačidlo nižšie otvoríš okno pre výpočet materiálu, času a zisku.');

            await channel.send({ embeds: [embed], components: [row] });
            console.log('Hlavný panel kalkulačky bol úspešne vyvesený!');
        } catch (error) {
            console.error('Chyba pri nastavovaní kanála:', error);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        const selectedValue = interaction.customId === 'btn_fixboxy' ? 'fixboxy' : 'weed';

        const modal = new ModalBuilder()
            .setCustomId(`modal_${selectedValue}`)
            .setTitle(selectedValue === 'fixboxy' ? 'Zadaj množstvo ocele' : 'Zadaj množstvo trávy');

        const inputField = new TextInputBuilder()
            .setCustomId('amount_input')
            .setLabel(selectedValue === 'fixboxy' ? 'Počet kusov ocele:' : 'Počet neocistenej trávy:')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(selectedValue === 'fixboxy' ? 'Napr. 567, 400...' : 'Napr. 1648...')
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(inputField));
        await interaction.showModal(modal);
        return;
    }

    if (interaction.isModalSubmit()) {
        const inputVal = parseInt(interaction.fields.getTextInputValue('amount_input'));

        if (isNaN(inputVal) || inputVal <= 0) {
            return interaction.reply({ content: '❌ Zadaj platné číslo väčšie ako 0!', ephemeral: true });
        }

        let embed = new EmbedBuilder();
        const actionRow = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('btn_fixboxy')
                    .setLabel('⚙ Ďalšie Fixboxy')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('btn_weed')
                    .setLabel('🌿 Ďalšie Weed Bags')
                    .setStyle(ButtonStyle.Primary)
            );

        if (interaction.customId === 'modal_fixboxy') {
            const cfg = config.fixboxy;

            let batches = Math.floor(inputVal / cfg.steelPerBatch);
            let remainderSteel = inputVal % cfg.steelPerBatch;
            let totalFixboxes = batches * cfg.itemsPerBatch;
            let totalSeconds = batches * cfg.secondsPerBatch;
            let sellMin = totalFixboxes * cfg.priceMin;
            let sellMax = totalFixboxes * cfg.priceMax;

            let hours = Math.floor(totalSeconds / 3600);
            let minutes = Math.floor((totalSeconds % 3600) / 60);
            let seconds = totalSeconds % 60;
            let timeText = `${hours > 0 ? hours + 'h ' : ''}${minutes} min ${seconds > 0 ? seconds + 's' : ''}`.trim();

            embed.setColor('#5865F2')
                .setTitle('⚙️ Výsledok: Fixboxy')
                .addFields(
                    { name: '📥 Vstupná oceľ', value: `**${inputVal} ks**`, inline: true },
                    { name: '📦 Výsledné fixboxy', value: `**${totalFixboxes} ks**`, inline: true },
                    { name: '🔄 Zvyšok ocele', value: `**${remainderSteel} ks**`, inline: true },
                    { name: '⏱️ Celkový čas výroby', value: `**${timeText}**`, inline: false },
                    { name: '💵 Odhadovaný predaj', value: `**$${sellMin.toLocaleString()} – $${sellMax.toLocaleString()}**`, inline: false }
                );

        } else if (interaction.customId === 'modal_weed') {
            const cfg = config.weed;

            let numBags = Math.floor(inputVal / cfg.weedPerBag);
            let remainderWeed = inputVal % cfg.weedPerBag;
            let cleanTime = inputVal * cfg.secondsPerClean; 
            let packTime = numBags * cfg.secondsPerPack; 
            let totalSeconds = cleanTime + packTime;
            let totalRevenue = numBags * cfg.pricePerBag;

            let hours = Math.floor(totalSeconds / 3600);
            let minutes = Math.floor((totalSeconds % 3600) / 60);
            let seconds = totalSeconds % 60;
            let timeText = `${hours > 0 ? hours + 'h ' : ''}${minutes} min ${seconds > 0 ? seconds + 's' : ''}`.trim();

            embed.setColor('#2ecc71')
                .setTitle('🌿 Výsledok: Weed Bags')
                .addFields(
                    { name: '📥 Vstupná tráva', value: `**${inputVal} ks**`, inline: true },
                    { name: '📦 Výsledné balíky', value: `**${numBags} ks**`, inline: true },
                    { name: '🔄 Zvyšok trávy', value: `**${remainderWeed} ks**`, inline: true },
                    { name: '⏱️ Celkový čas (čistenie + balenie)', value: `**${timeText}**`, inline: false },
                    { name: '💵 Predajná cena celkom', value: `**$${totalRevenue.toLocaleString()}**`, inline: false }
                );
        }

        await interaction.reply({ embeds: [embed], components: [actionRow], ephemeral: true });
    }
});

// --- 3. PRIHLÁSENIE BOTA CEZ BEZPEČNÝ TOKEN ---
client.login(process.env.DISCORD_TOKEN);