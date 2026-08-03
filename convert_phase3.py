import csv
import glob
import json
import os


DATA_PATTERN = os.path.join(os.path.dirname(__file__), 'DataBreak', '*_1_2.csv')
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), 'phase3-data.json')

PARTICIPANT_MAP = {
    '1': '参加者A',
    '2': '参加者B',
    '3': '参加者C',
    '5': '参加者D',
    '6': '参加者E',
    '7': '参加者F',
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
    pitch_count = 0

    for file_path in sorted(glob.glob(DATA_PATTERN)):
        participant_number = os.path.basename(file_path).split('_')[0]
        participant = PARTICIPANT_MAP[participant_number]

        with open(file_path, encoding='utf-8-sig', newline='') as source:
            rows = list(csv.DictReader(source))

        pitch_count += len(rows)

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
            'source_pattern': 'DataBreak/*_1_2.csv',
        },
        'transitions': transitions,
    }

    with open(OUTPUT_PATH, 'w', encoding='utf-8') as destination:
        json.dump(output, destination, ensure_ascii=False, indent=2)

    print(f'{pitch_count}球・{len(transitions)}遷移を {OUTPUT_PATH} に出力しました．')


if __name__ == '__main__':
    main()
