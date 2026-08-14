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
        punishment: '20,000'
    },
    {
        id: 'zara',
        name: 'زره',
        punishment: '1,000'
    },
    {
        id: 'escape',
        name: 'هروب من العساكر',
        punishment: 'حرمان أسبوع'
    },
    {
        id: 'challenge',
        name: 'تحدي واحد',
        punishment: '5,000 + حجز موتر'
    },
    {
        id: 'handbrake',
        name: 'سحب جلنط',
        punishment: '500'
    },
    {
        id: 'middle_road',
        name: 'توقف بنص الشارع',
        punishment: '700'
    },
    {
        id: 'no_plate',
        name: 'فك لوحة بدون تصريح',
        punishment: '900'
    },
    {
        id: 'speeding',
        name: 'مسرع فوق 65 ميل',
        punishment: '2,000'
    },
    {
        id: 'accident',
        name: 'تسببت بحادث',
        punishment: '200 + سجن 3 أيام'
    }
];

// الأمر الداخلي mukhalafa
// ويظهر بالعربي "مخالفة" حسب لغة Discord
const violationCommand = new SlashCommandBuilder()
    .setName('mukhalafa')
    .setNameLocalizations({
        ar: 'مخالفة'
    })
    .setDescription('تسجيل مخالفة على عضو')
    .setDescriptionLocalizations({
        ar: 'تسجيل مخالفة على عضو'
    })
    .addUserOption(option =>
        option
            .setName('المخالف')
            .setNameLocalizations({
                ar: 'المخالف'
            })
            .setDescription('اختر الشخص المخالف')
            .setDescriptionLocalizations({
                ar: 'اختر الشخص المخالف'
            })
            .setRequired(true)
    )
    .addAttachmentOption(option =>
        option
            .setName('الصورة')
            .setNameLocalizations({
                ar: 'الصورة'
            })
            .setDescription('ارفع صورة المخالفة')
            .setDescriptionLocalizations({
                ar: 'ارفع صورة المخالفة'
            })
            .setRequired(true)
    );

async function handleViolationCommand(interaction) {

    // التحقق من الروم
    if (interaction.channelId !== VIOLATIONS_CHANNEL_ID) {
        return interaction.reply({
            content:
                `❌ لا يمكنك استخدام أمر المخالفات هنا.\n` +
                `استخدمه في <#${VIOLATIONS_CHANNEL_ID}>.`,
            ephemeral: true
        });
    }

    // التحقق من رتبة العسكري
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

    // التأكد أن الملف صورة
    if (!image.contentType || !image.contentType.startsWith('image/')) {
        return interaction.reply({
            content: '❌ يجب رفع صورة فقط.',
            ephemeral: true
        });
    }

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(
            `violation_select:${target.id}:${interaction.user.id}`
        )
        .setPlaceholder('اختر المخالفة')
        .addOptions(
            violations.map(violation => ({
                label: violation.name,
                description: violation.punishment,
                value: violation.id
            }))
        );

    const row = new ActionRowBuilder()
        .addComponents(selectMenu);

    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 تسجيل مخالفة')
        .addFields({
            name: '👤 المخالف',
            value: `${target}`,
            inline: true
        })
        .setDescription(
            '**اختر نوع المخالفة من شريط الاختيارات بالأسفل.**'
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

    if (parts.length !== 3) {
        return;
    }

    const targetId = parts[1];
    const militaryId = parts[2];

    // فقط العسكري الذي بدأ المخالفة يستطيع الاختيار
    if (interaction.user.id !== militaryId) {
        return interaction.reply({
            content: '❌ هذه القائمة ليست لك.',
            ephemeral: true
        });
    }

    // التحقق من الرتبة
    if (!interaction.member.roles.cache.has(MILITARY_ROLE_ID)) {
        return interaction.reply({
            content: '❌ هذا الخيار مخصص للعساكر فقط.',
            ephemeral: true
        });
    }

    const violationId = interaction.values[0];

    const violation = violations.find(
        item => item.id === violationId
    );

    if (!violation) {
        return interaction.reply({
            content: '❌ لم يتم العثور على نوع المخالفة.',
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

    const imageUrl = originalEmbed?.image?.url || null;

    // رسالة الخاص
    const dmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🚨 تم تسجيل مخالفة عليك')
        .setDescription(
            'تم تسجيل مخالفة عليك في **مجتمع النظيم**.'
        )
        .addFields(
            {
                name: '👤 المخالف',
                value: `<@${target.id}>`,
                inline: true
            },
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
            }
        )
        .setTimestamp();

    if (imageUrl) {
        dmEmbed.setImage(imageUrl);
    }

    let dmSent = true;

    try {
        await target.send({
            embeds: [dmEmbed]
        });
    } catch (error) {
        dmSent = false;
        console.log(
            `تعذر إرسال DM للمستخدم ${target.id}:`,
            error.message
        );
    }

    // تحديث رسالة المخالفة
    const completedEmbed = EmbedBuilder
        .from(interaction.message.embeds[0])
        .setColor(0x00FF00)
        .setTitle('✅ تم تسجيل المخالفة')
        .setDescription(
            `**المخالف:** ${target}\n\n` +
            `**المخالفة:** ${violation.name}\n` +
            `**العقوبة:** ${violation.punishment}\n\n` +
            `**سجلها:** ${interaction.user}\n\n` +
            `${dmSent ? '📩 تم إرسال المخالفة للخاص.' : '⚠️ تعذر إرسال المخالفة للخاص.'}`
        )
        .setTimestamp();

    return interaction.update({
        embeds: [completedEmbed],
        components: []
    });
}

module.exports = {
    violationCommand,
    handleViolationCommand,
    handleViolationSelect
};
