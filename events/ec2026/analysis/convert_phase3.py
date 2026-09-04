import csv
import glob
import json
import os


EVENT_ROOT = os.path.dirname(os.path.dirname(__file__))
DATA_PATTERN = os.path.join(EVENT_ROOT, 'data', 'raw', 'phase', '*_1_2.csv')
OUTPUT_PATH = os.path.join(EVENT_ROOT, 'data', 'public', 'phase3-data.json')

PARTICIPANT_MAP = {
    '1': 'Player 1',
    '2': 'Player 2',
    '3': 'Player 3',
    '5': 'Player 5',
    '6': 'Player 6',
    '7': 'Player 7',
}

REACTION_MAP = {
    'Take': '見逃し',
    'CheckSwing': 'ハーフスイング',
    'Swing': '空振り',
}


def course_height(course):
    if 'High' in course:
        return '高め'
    if 'Low' in course:
        return '低め'
    return '真ん中'


def main():
    transitions = []
    sessions = []
    pitch_count = 0

    for file_path in sorted(glob.glob(DATA_PATTERN)):
        participant_number = os.path.basename(file_path).split('_')[0]
        participant = PARTICIPANT_MAP[participant_number]

        with open(file_path, encoding='utf-8-sig', newline='') as source:
            rows = list(csv.DictReader(source))

        pitch_count += len(rows)

        pitches = []
        for sequence, row in enumerate(rows, start=1):
            previous = rows[sequence - 2] if sequence > 1 else None
            speed = row.get('Pitch_Speed_Kmph', '').strip()
            pitches.append({
                'sequence': sequence,
                'pitch_number': int(row['Pitch_Number']),
                'pitch_type': row['Selected_Pitch_Type'],
                'course': row['Selected_Course_Zone'],
                'speed_kmph': float(speed) if speed else None,
                'batter_reaction': REACTION_MAP[row['Batter_Reaction']],
                'catch_result': row['Catch_Result'],
                'pitch_changed_from_previous': (
                    None if previous is None
                    else previous['Selected_Pitch_Type'] != row['Selected_Pitch_Type']
                ),
                'course_changed_from_previous': (
                    None if previous is None
                    else previous['Selected_Course_Zone'] != row['Selected_Course_Zone']
                ),
            })

        sessions.append({
            'participant': participant,
            'pitches': pitches,
        })

        for current, following in zip(rows, rows[1:]):
            transitions.append({
                'participant': participant,
                'previous_reaction': REACTION_MAP[current['Batter_Reaction']],
                'pitch_changed': current['Selected_Pitch_Type'] != following['Selected_Pitch_Type'],
                'course_changed': current['Selected_Course_Zone'] != following['Selected_Course_Zone'],
                'next_pitch_group': 'ストレート' if following['Selected_Pitch_Type'] == 'Straight' else '変化球',
                'next_course_height': course_height(following['Selected_Course_Zone']),
            })

    output = {
        'metadata': {
            'phase': 3,
            'participants': len(PARTICIPANT_MAP),
            'pitches': pitch_count,
            'transitions': len(transitions),
            'source_pattern': 'data/raw/phase/*_1_2.csv',
        },
        'sessions': sessions,
        'transitions': transitions,
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as destination:
        json.dump(output, destination, ensure_ascii=False, indent=2)

    print(f'{pitch_count}球・{len(transitions)}遷移を {OUTPUT_PATH} に出力しました．')


if __name__ == '__main__':
    main()
