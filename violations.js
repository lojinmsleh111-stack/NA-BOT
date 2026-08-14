const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');

const MILITARY_ROLE_ID = '1511149768066470009';
const VIOLATIONS_CHANNEL_ID = '1508322335688626337';

const violations = [
    {
        id: 'tafheet',
        name: 'تفحيط',
        description: '20,000',
        punishment: '20,000'
    },
    {
        id: 'zara',
        name: 'زره',
        description: '1,000',
        punishment: '1,000'
    },
    {
        id: 'escape',
        name: 'هروب من العساكر',
        description: 'حرمان أسبوع',
        punishment: 'حرمان أسبوع'
    },
    {
        id: 'challenge',
        name: 'تحدي واحد',
        description: '5,000 + حجز موتر',
        punishment: '5,000 + حجز موتر'
    },
    {
        id: 'handbrake',
        name: 'سحب جلنط',
        description: '500',
        punishment: '500'
    },
    {
        id: 'middle_road',
        name: 'توقف بنص الشارع',
        description: '700',
        punishment: '700'
    },
    {
        id: 'no_plate',
        name: 'فك لوحة بدون تصريح',
        description: '900',
        punishment: '900'
    },
    {
        id: 'speeding',
        name: 'مسرع فوق 65 ميل',
        description: '2,000',
        punishment: '2,000'
    },
    {
        id: 'accident',
        name: 'تسببت بحادث',
        description: '200 + سجن 3 أيام',
        punishment: '200 + سجن 3 أيام'
    }
];

// أمر /مخالفة
const violationCommand = new SlashCommandBuilder()
    .setName('مخالفة')
    .setDescription('تسجيل مخالفة على عضو')
    .addUserOption(option =>
        option
            .setName('المخالف')
            .setDescription('اختر الشخص المخالف')
            .setRequired(true)
    )
    .addAttachmentOption(option =>
        option
            .setName('الصورة')
            .setDescription('ارفع صورة المخالفة')
            .setRequired(true)
    )
    .toJSON();

async function handleViolationCommand(interaction) {
    // التأكد من الروم
    if (interaction.channelId !== VIOLATIONS_CHANNEL_ID) {
        return interaction.reply({
            content: `❌ لا يمكنك استخدام أمر المخالفات هنا.\nاستخدم الأمر في <#${VIOLATIONS_CHANNEL_ID}>.`,
            ephemeral: true
        });
    }

    // التأكد من رتبة العسكري
    if (!interaction.member.roles.cache.has(MILITARY_ROLE_ID)) {
        return interaction.reply({
            content: '❌ هذا الأمر مخصص للعساكر فقط.',
            ephemeral: true
        });
    }

    const target = interaction.options.getMember('المخالف');
    const image = interaction.options.getAttachment('الصورة');

    if (!target) {
        return interaction.reply({
            content: '❌ لم أستطع العثور على العضو المخالف.',
            ephemeral: true
        });
    }

    if (!image.contentType || !image.contentType.startsWith('image/')) {
        return interaction.reply({
            content: '❌ يجب أن تكون المرفقات صورة.',
            ephemeral: true
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`violation_select:${target.id}:${interaction.user.id}`)
        .setPlaceholder('اختر نوع المخالفة')
        .addOptions(
            violations.map(v => ({
                label: v.name,
                description: v.description,
                value: v.id
            }))
        );

    const row = new ActionRowBuilder()
        .addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle('🚨 تسجيل مخالفة')
        .setDescription(
            `**المخالف:** ${target}\n\n` +
            'اختر نوع المخالفة من القائمة بالأسفل.'
        )
        .setImage(image.url)
        .setFooter({
            text: `العسكري: ${interaction.user.tag}`
        })
        .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        components: [row]
    });
}

async function handleViolationSelect(interaction) {
    const parts = interaction.customId.split(':');

    if (parts.length !== 3) return;

    const targetId = parts[1];
    const militaryId = parts[2];

    // التأكد أن الشخص الذي ضغط هو نفس العسكري
    if (interaction.user.id !== militaryId) {
        return interaction.reply({
            content: '❌ هذه القائمة ليست لك.',
            ephemeral: true
        });
    }

    // التأكد من الرتبة
    if (!interaction.member.roles.cache.has(MILITARY_ROLE_ID)) {
        return interaction.reply({
            content: '❌ هذا الخيار مخصص للعساكر فقط.',
            ephemeral: true
        });
    }

    const violationId = interaction.values[0];
    const violation = violations.find(v => v.id === violationId);

    if (!violation) {
        return interaction.reply({
            content: '❌ نوع المخالفة غير موجود.',
            ephemeral: true
        });
    }

    let target;

    try {
        target = await interaction.guild.members.fetch(targetId);
    } catch {
        return interaction.reply({
            content: '❌ لم أستطع العثور على المخالف.',
            ephemeral: true
        });
    }

    const originalEmbed = interaction.message.embeds[0];

    const imageUrl = originalEmbed?.image?.url;

    const dmEmbed = new EmbedBuilder()
        .setTitle('🚨 تم تسجيل مخالفة عليك')
        .setDescription(
            `تم تسجيل مخالفة عليك في **مجتمع النظيم**.`
        )
        .addFields(
            {
                name: '📋 المخالفة',
                value: violation.name,
                inline: true
            },
            {
                name: '⚖️ العقوبة',
                value: violation.punishment,
                inline: true
            },
            {
                name: '👮 العسكري',
                value: `<@${interaction.user.id}>`,
                inline: true
            },
            {
                name: '👤 المخالف',
                value: `<@${target.id}>`,
                inline: true
            }
        )
        .setTimestamp();

    if (imageUrl) {
        dmEmbed.setImage(imageUrl);
    }

    // إرسال المخالفة في الخاص
    try {
        await target.send({
            embeds: [dmEmbed]
        });
    } catch (error) {
        console.log(
            `تعذر إرسال DM للمستخدم ${target.id}:`,
            error.message
        );
    }

    // تحديث رسالة المخالفة
    const completedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setTitle('✅ تم تسجيل المخالفة')
        .setDescription(
            `**المخالف:** ${target}\n\n` +
            `**المخالفة:** ${violation.name}\n` +
            `**العقوبة:** ${violation.punishment}\n\n` +
            `**سجلها:** ${interaction.user}`
        )
        .setTimestamp();

    await interaction.update({
        embeds: [completedEmbed],
        components: []
    });
}

module.exports = {
    violationCommand,
    handleViolationCommand,
    handleViolationSelect
};const {
    SlashCommandBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    EmbedBuilder
} = require('discord.js');

const MILITARY_ROLE_ID = '1511149768066470009';
const VIOLATIONS_CHANNEL_ID = '1508322335688626337';

const violations = [
    {
        id: 'tafheet',
        name: 'تفحيط',
        description: '20,000',
        punishment: '20,000'
    },
    {
        id: 'zara',
        name: 'زره',
        description: '1,000',
        punishment: '1,000'
    },
    {
        id: 'escape',
        name: 'هروب من العساكر',
        description: 'حرمان أسبوع',
        punishment: 'حرمان أسبوع'
    },
    {
        id: 'challenge',
        name: 'تحدي واحد',
        description: '5,000 + حجز موتر',
        punishment: '5,000 + حجز موتر'
    },
    {
        id: 'handbrake',
        name: 'سحب جلنط',
        description: '500',
        punishment: '500'
    },
    {
        id: 'middle_road',
        name: 'توقف بنص الشارع',
        description: '700',
        punishment: '700'
    },
    {
        id: 'no_plate',
        name: 'فك لوحة بدون تصريح',
        description: '900',
        punishment: '900'
    },
    {
        id: 'speeding',
        name: 'مسرع فوق 65 ميل',
        description: '2,000',
        punishment: '2,000'
    },
    {
        id: 'accident',
        name: 'تسببت بحادث',
        description: '200 + سجن 3 أيام',
        punishment: '200 + سجن 3 أيام'
    }
];

// أمر /مخالفة
const violationCommand = new SlashCommandBuilder()
    .setName('مخالفة')
    .setDescription('تسجيل مخالفة على عضو')
    .addUserOption(option =>
        option
            .setName('المخالف')
            .setDescription('اختر الشخص المخالف')
            .setRequired(true)
    )
    .addAttachmentOption(option =>
        option
            .setName('الصورة')
            .setDescription('ارفع صورة المخالفة')
            .setRequired(true)
    )
    .toJSON();

async function handleViolationCommand(interaction) {
    // التأكد من الروم
    if (interaction.channelId !== VIOLATIONS_CHANNEL_ID) {
        return interaction.reply({
            content: `❌ لا يمكنك استخدام أمر المخالفات هنا.\nاستخدم الأمر في <#${VIOLATIONS_CHANNEL_ID}>.`,
            ephemeral: true
        });
    }

    // التأكد من رتبة العسكري
    if (!interaction.member.roles.cache.has(MILITARY_ROLE_ID)) {
        return interaction.reply({
            content: '❌ هذا الأمر مخصص للعساكر فقط.',
            ephemeral: true
        });
    }

    const target = interaction.options.getMember('المخالف');
    const image = interaction.options.getAttachment('الصورة');

    if (!target) {
        return interaction.reply({
            content: '❌ لم أستطع العثور على العضو المخالف.',
            ephemeral: true
        });
    }

    if (!image.contentType || !image.contentType.startsWith('image/')) {
        return interaction.reply({
            content: '❌ يجب أن تكون المرفقات صورة.',
            ephemeral: true
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`violation_select:${target.id}:${interaction.user.id}`)
        .setPlaceholder('اختر نوع المخالفة')
        .addOptions(
            violations.map(v => ({
                label: v.name,
                description: v.description,
                value: v.id
            }))
        );

    const row = new ActionRowBuilder()
        .addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setTitle('🚨 تسجيل مخالفة')
        .setDescription(
            `**المخالف:** ${target}\n\n` +
            'اختر نوع المخالفة من القائمة بالأسفل.'
        )
        .setImage(image.url)
        .setFooter({
            text: `العسكري: ${interaction.user.tag}`
        })
        .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        components: [row]
    });
}

async function handleViolationSelect(interaction) {
    const parts = interaction.customId.split(':');

    if (parts.length !== 3) return;

    const targetId = parts[1];
    const militaryId = parts[2];

    // التأكد أن الشخص الذي ضغط هو نفس العسكري
    if (interaction.user.id !== militaryId) {
        return interaction.reply({
            content: '❌ هذه القائمة ليست لك.',
            ephemeral: true
        });
    }

    // التأكد من الرتبة
    if (!interaction.member.roles.cache.has(MILITARY_ROLE_ID)) {
        return interaction.reply({
            content: '❌ هذا الخيار مخصص للعساكر فقط.',
            ephemeral: true
        });
    }

    const violationId = interaction.values[0];
    const violation = violations.find(v => v.id === violationId);

    if (!violation) {
        return interaction.reply({
            content: '❌ نوع المخالفة غير موجود.',
            ephemeral: true
        });
    }

    let target;

    try {
        target = await interaction.guild.members.fetch(targetId);
    } catch {
        return interaction.reply({
            content: '❌ لم أستطع العثور على المخالف.',
            ephemeral: true
        });
    }

    const originalEmbed = interaction.message.embeds[0];

    const imageUrl = originalEmbed?.image?.url;

    const dmEmbed = new EmbedBuilder()
        .setTitle('🚨 تم تسجيل مخالفة عليك')
        .setDescription(
            `تم تسجيل مخالفة عليك في **مجتمع النظيم**.`
        )
        .addFields(
            {
                name: '📋 المخالفة',
                value: violation.name,
                inline: true
            },
            {
                name: '⚖️ العقوبة',
                value: violation.punishment,
                inline: true
            },
            {
                name: '👮 العسكري',
                value: `<@${interaction.user.id}>`,
                inline: true
            },
            {
                name: '👤 المخالف',
                value: `<@${target.id}>`,
                inline: true
            }
        )
        .setTimestamp();

    if (imageUrl) {
        dmEmbed.setImage(imageUrl);
    }

    // إرسال المخالفة في الخاص
    try {
        await target.send({
            embeds: [dmEmbed]
        });
    } catch (error) {
        console.log(
            `تعذر إرسال DM للمستخدم ${target.id}:`,
            error.message
        );
    }

    // تحديث رسالة المخالفة
    const completedEmbed = EmbedBuilder.from(interaction.message.embeds[0])
        .setTitle('✅ تم تسجيل المخالفة')
        .setDescription(
            `**المخالف:** ${target}\n\n` +
            `**المخالفة:** ${violation.name}\n` +
            `**العقوبة:** ${violation.punishment}\n\n` +
            `**سجلها:** ${interaction.user}`
        )
        .setTimestamp();

    await interaction.update({
        embeds: [completedEmbed],
        components: []
    });
}

module.exports = {
    violationCommand,
    handleViolationCommand,
    handleViolationSelect
};
