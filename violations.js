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

// ==============================
//          /mukhalafa
// ==============================

const violationCommand = new SlashCommandBuilder()
    .setName('mukhalafa')
    .setDescription('تسجيل مخالفة على عضو')
    .addUserOption(option =>
        option
            .setName('member')
            .setDescription('اختر الشخص المخالف')
            .setRequired(true)
    )
    .addAttachmentOption(option =>
        option
            .setName('image')
            .setDescription('ارفع صورة المخالفة')
            .setRequired(true)
    );

// ==============================
//      تنفيذ أمر المخالفة
// ==============================

async function handleViolationCommand(interaction) {

    // التحقق من الروم
    if (interaction.channelId !== VIOLATIONS_CHANNEL_ID) {
        return interaction.reply({
            content:
                `❌ لا يمكنك استخدام أمر المخالفات هنا.\n` +
                `استخدم الأمر في <#${VIOLATIONS_CHANNEL_ID}>.`,
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

    const target =
        interaction.options.getMember('member');

    const image =
        interaction.options.getAttachment('image');

    if (!target) {
        return interaction.reply({
            content: '❌ لم أستطع العثور على العضو المخالف.',
            ephemeral: true
        });
    }

    if (!image) {
        return interaction.reply({
            content: '❌ يجب رفع صورة للمخالفة.',
            ephemeral: true
        });
    }

    // التأكد أن الملف صورة
    if (
        !image.contentType ||
        !image.contentType.startsWith('image/')
    ) {
        return interaction.reply({
            content: '❌ الملف المرفوع يجب أن يكون صورة.',
            ephemeral: true
        });
    }

    // ==============================
    //       شريط المخالفات
    // ==============================

    const selectMenu =
        new StringSelectMenuBuilder()
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

    const row =
        new ActionRowBuilder()
            .addComponents(selectMenu);

    // ==============================
    //       رسالة الاختيار
    // ==============================

    const embed =
        new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('🚨 تسجيل مخالفة')
            .setDescription(
                '**اختر نوع المخالفة من شريط الاختيارات بالأسفل.**'
            )
            .addFields({
                name: '👤 المخالف',
                value: `${target}`,
                inline: true
            })
            .addFields({
                name: '👮 العسكري',
                value: `${interaction.user}`,
                inline: true
            })
            .setImage(image.url)
            .setTimestamp();

    return interaction.reply({
        embeds: [embed],
        components: [row]
    });
}

// ==============================
//       اختيار المخالفة
// ==============================

async function handleViolationSelect(interaction) {

    const parts =
        interaction.customId.split(':');

    if (parts.length !== 3) {
        return;
    }

    const targetId = parts[1];
    const militaryId = parts[2];

    // ==============================
    // العسكري الذي بدأ العملية فقط
    // ==============================

    if (interaction.user.id !== militaryId) {
        return interaction.reply({
            content:
                '❌ هذه قائمة المخالفة ليست لك.',
            ephemeral: true
        });
    }

    // ==============================
    // التأكد من رتبة العسكري
    // ==============================

    if (
        !interaction.member.roles.cache.has(
            MILITARY_ROLE_ID
        )
    ) {
        return interaction.reply({
            content:
                '❌ هذا الخيار مخصص للعساكر فقط.',
            ephemeral: true
        });
    }

    // ==============================
    // معرفة المخالفة
    // ==============================

    const violationId =
        interaction.values[0];

    const violation =
        violations.find(
            item =>
                item.id === violationId
        );

    if (!violation) {
        return interaction.reply({
            content:
                '❌ لم يتم العثور على نوع المخالفة.',
            ephemeral: true
        });
    }

    // ==============================
    // جلب المخالف
    // ==============================

    let target;

    try {
        target =
            await interaction.guild.members.fetch(
                targetId
            );
    } catch (error) {
        return interaction.reply({
            content:
                '❌ لم أستطع العثور على المخالف.',
            ephemeral: true
        });
    }

    // ==============================
    // جلب الصورة من الرسالة الأصلية
    // ==============================

    const originalEmbed =
        interaction.message.embeds[0];

    const imageUrl =
        originalEmbed?.image?.url || null;

    // ==============================
    // رسالة الخاص للمخالف
    // ==============================

    const dmEmbed =
        new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle(
                '🚨 تم تسجيل مخالفة عليك'
            )
            .setDescription(
                'تم تسجيل مخالفة عليك في **مجتمع النظيم**.'
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
                    value: `${interaction.user}`,
                    inline: true
                },
                {
                    name: '👤 المخالف',
                    value: `${target}`,
                    inline: true
                }
            )
            .setFooter({
                text: 'نظام مخالفات مجتمع النظيم'
            })
            .setTimestamp();

    if (imageUrl) {
        dmEmbed.setImage(imageUrl);
    }

    // ==============================
    // إرسال DM
    // ==============================

    let dmSent = true;

    try {
        await target.send({
            embeds: [dmEmbed]
        });
    } catch (error) {
        dmSent = false;

        console.error(
            `❌ تعذر إرسال DM للمستخدم ${target.id}:`,
            error.message
        );
    }

    // ==============================
    // تحديث رسالة المخالفة
    // ==============================

    const completedEmbed =
        EmbedBuilder
            .from(
                interaction.message.embeds[0]
            )
            .setColor(0x00FF00)
            .setTitle(
                '✅ تم تسجيل المخالفة'
            )
            .setDescription(
                `**المخالف:** ${target}\n\n` +
                `**المخالفة:** ${violation.name}\n` +
                `**العقوبة:** ${violation.punishment}\n\n` +
                `**سجلها:** ${interaction.user}\n\n` +
                (
                    dmSent
                        ? '📩 تم إرسال تفاصيل المخالفة إلى الخاص.'
                        : '⚠️ تعذر إرسال تفاصيل المخالفة إلى الخاص.'
                )
            )
            .setTimestamp();

    return interaction.update({
        embeds: [completedEmbed],
        components: []
    });
}

// ==============================
//           التصدير
// ==============================

module.exports = {
    violationCommand,
    handleViolationCommand,
    handleViolationSelect
};
