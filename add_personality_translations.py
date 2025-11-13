#!/usr/bin/env python3
"""
Add personality translations to all locale files
"""
import json
import os

# Translations for each language
translations = {
    'no': {
        "personality": "AI-coach personlighet",
        "personalityDescription": "Velg din coachs kommunikasjonsstil og tilnærming",
        "personalityNone": "Ingen personlighet valgt",
        "personalityZen": "🧘‍♂️ Zen-minimalist - Rolig og enkel",
        "personalityScience": "🔬 Vitenskapsnerd - Datadrevet",
        "personalityTough": "🪖 Tøff kjærlighet - Direkte og utfordrende",
        "personalityCheerleader": "🎉 Heiagjeng - Energisk og positiv",
        "personalityTherapist": "🛋️ Terapeut - Empatisk og støttende",
        "personalityStoic": "⚔️ Stoisk - Filosofisk og disiplinert",
        "personalityGamified": "🎮 Spillifisert - XP og oppdrag",
        "personalityRecovery": "🌿 Restitusjonsguide - Langsiktig helse",
        "personalityExecutive": "⏱️ Leder - Tidseffektiv",
        "personalityRealist": "🧢 Realist - Jordnær"
    },
    'sv': {
        "personality": "AI-coach personlighet",
        "personalityDescription": "Välj din tränares kommunikationsstil och tillvägagångssätt",
        "personalityNone": "Ingen personlighet vald",
        "personalityZen": "🧘‍♂️ Zen-minimalist - Lugn och enkel",
        "personalityScience": "🔬 Vetenskapsnörd - Datadriven",
        "personalityTough": "🪖 Tough Love - Direkt och utmanande",
        "personalityCheerleader": "🎉 Hejaklack - Energisk och positiv",
        "personalityTherapist": "🛋️ Terapeut - Empatisk och stödjande",
        "personalityStoic": "⚔️ Stoisk - Filosofisk och disciplinerad",
        "personalityGamified": "🎮 Spelifierad - XP och uppdrag",
        "personalityRecovery": "🌿 Återhämtningsguide - Långsiktig hälsa",
        "personalityExecutive": "⏱️ Chefstyp - Tidseffektiv",
        "personalityRealist": "🧢 Realist - Jordnära"
    },
    'de': {
        "personality": "KI-Trainer Persönlichkeit",
        "personalityDescription": "Wählen Sie den Kommunikationsstil Ihres Trainers",
        "personalityNone": "Keine Persönlichkeit ausgewählt",
        "personalityZen": "🧘‍♂️ Zen-Minimalist - Ruhig und einfach",
        "personalityScience": "🔬 Wissenschafts-Nerd - Datengetrieben",
        "personalityTough": "🪖 Strenge Liebe - Direkt und fordernd",
        "personalityCheerleader": "🎉 Cheerleader - Energetisch und positiv",
        "personalityTherapist": "🛋️ Therapeut - Empathisch und unterstützend",
        "personalityStoic": "⚔️ Stoisch - Philosophisch und diszipliniert",
        "personalityGamified": "🎮 Spielifiziert - XP und Quests",
        "personalityRecovery": "🌿 Erholungsweise - Langfristige Gesundheit",
        "personalityExecutive": "⏱️ Geschäftsführer - Zeiteffizient",
        "personalityRealist": "🧢 Realist - Bodenständig"
    },
    'es': {
        "personality": "Personalidad del entrenador IA",
        "personalityDescription": "Elige el estilo de comunicación de tu entrenador",
        "personalityNone": "Sin personalidad seleccionada",
        "personalityZen": "🧘‍♂️ Minimalista Zen - Tranquilo y simple",
        "personalityScience": "🔬 Científico - Basado en datos",
        "personalityTough": "🪖 Amor duro - Directo y desafiante",
        "personalityCheerleader": "🎉 Animador - Enérgico y positivo",
        "personalityTherapist": "🛋️ Terapeuta - Empático y de apoyo",
        "personalityStoic": "⚔️ Estoico - Filosófico y disciplinado",
        "personalityGamified": "🎮 Gamificado - XP y misiones",
        "personalityRecovery": "🌿 Sabio de recuperación - Salud a largo plazo",
        "personalityExecutive": "⏱️ Ejecutivo - Eficiente en tiempo",
        "personalityRealist": "🧢 Realista - Con los pies en la tierra"
    },
    'fr': {
        "personality": "Personnalité du coach IA",
        "personalityDescription": "Choisissez le style de communication de votre coach",
        "personalityNone": "Aucune personnalité sélectionnée",
        "personalityZen": "🧘‍♂️ Minimaliste Zen - Calme et simple",
        "personalityScience": "🔬 Geek scientifique - Basé sur les données",
        "personalityTough": "🪖 Amour dur - Direct et exigeant",
        "personalityCheerleader": "🎉 Pom-pom girl - Énergique et positif",
        "personalityTherapist": "🛋️ Thérapeute - Empathique et soutenant",
        "personalityStoic": "⚔️ Stoïque - Philosophique et discipliné",
        "personalityGamified": "🎮 Gamifié - XP et quêtes",
        "personalityRecovery": "🌿 Sage de récupération - Santé à long terme",
        "personalityExecutive": "⏱️ Cadre - Efficace en temps",
        "personalityRealist": "🧢 Réaliste - Terre à terre"
    },
    'da': {
        "personality": "AI-coach personlighed",
        "personalityDescription": "Vælg din coachs kommunikationsstil og tilgang",
        "personalityNone": "Ingen personlighed valgt",
        "personalityZen": "🧘‍♂️ Zen-minimalist - Rolig og enkel",
        "personalityScience": "🔬 Videnskabsnørd - Datadrevet",
        "personalityTough": "🪖 Hård kærlighed - Direkte og udfordrende",
        "personalityCheerleader": "🎉 Cheerleader - Energisk og positiv",
        "personalityTherapist": "🛋️ Terapeut - Empatisk og støttende",
        "personalityStoic": "⚔️ Stoisk - Filosofisk og disciplineret",
        "personalityGamified": "🎮 Gamificeret - XP og quests",
        "personalityRecovery": "🌿 Restitutionsvejleder - Langsigtet sundhed",
        "personalityExecutive": "⏱️ Leder - Tidseffektiv",
        "personalityRealist": "🧢 Realist - Jordnær"
    },
    'it': {
        "personality": "Personalità del coach IA",
        "personalityDescription": "Scegli lo stile di comunicazione del tuo coach",
        "personalityNone": "Nessuna personalità selezionata",
        "personalityZen": "🧘‍♂️ Minimalista Zen - Calmo e semplice",
        "personalityScience": "🔬 Nerd della scienza - Basato sui dati",
        "personalityTough": "🪖 Amore duro - Diretto e impegnativo",
        "personalityCheerleader": "🎉 Cheerleader - Energico e positivo",
        "personalityTherapist": "🛋️ Terapeuta - Empatico e di supporto",
        "personalityStoic": "⚔️ Stoico - Filosofico e disciplinato",
        "personalityGamified": "🎮 Gamificato - XP e missioni",
        "personalityRecovery": "🌿 Saggio del recupero - Salute a lungo termine",
        "personalityExecutive": "⏱️ Esecutivo - Efficiente nel tempo",
        "personalityRealist": "🧢 Realista - Con i piedi per terra"
    },
    'ja': {
        "personality": "AIコーチのパーソナリティ",
        "personalityDescription": "コーチのコミュニケーションスタイルを選択",
        "personalityNone": "パーソナリティ未選択",
        "personalityZen": "🧘‍♂️ 禅ミニマリスト - 穏やかでシンプル",
        "personalityScience": "🔬 科学オタク - データ駆動型",
        "personalityTough": "🪖 厳しい愛 - 直接的で挑戦的",
        "personalityCheerleader": "🎉 チアリーダー - エネルギッシュでポジティブ",
        "personalityTherapist": "🛋️ セラピスト - 共感的でサポート的",
        "personalityStoic": "⚔️ ストイック - 哲学的で規律正しい",
        "personalityGamified": "🎮 ゲーミフィケーション - XPとクエスト",
        "personalityRecovery": "🌿 回復の賢者 - 長期的な健康",
        "personalityExecutive": "⏱️ エグゼクティブ - 時間効率的",
        "personalityRealist": "🧢 リアリスト - 現実的"
    },
    'zh': {
        "personality": "AI教练个性",
        "personalityDescription": "选择教练的沟通风格",
        "personalityNone": "未选择个性",
        "personalityZen": "🧘‍♂️ 禅宗极简主义 - 平静简单",
        "personalityScience": "🔬 科学极客 - 数据驱动",
        "personalityTough": "🪖 严格的爱 - 直接挑战",
        "personalityCheerleader": "🎉 啦啦队 - 充满活力和积极",
        "personalityTherapist": "🛋️ 治疗师 - 富有同情心和支持",
        "personalityStoic": "⚔️ 斯多葛 - 哲学和纪律",
        "personalityGamified": "🎮 游戏化 - 经验值和任务",
        "personalityRecovery": "🌿 恢复智者 - 长期健康",
        "personalityExecutive": "⏱️ 高管 - 时间高效",
        "personalityRealist": "🧢 现实主义者 - 脚踏实地"
    }
}

# Process each locale file
for lang_code, trans in translations.items():
    filepath = f'frontend/src/locales/{lang_code}.json'
    
    try:
        # Load existing file
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Add aiCoach section to account
        if 'account' not in data:
            data['account'] = {}
        
        data['account']['aiCoach'] = trans
        
        # Save back
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        print(f"✅ {lang_code}: Added personality translations")
        
    except Exception as e:
        print(f"❌ {lang_code}: Error - {e}")

print("\n✨ Translation update complete!")
