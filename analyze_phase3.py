import json
import math
import random


DATA_PATH = 'phase3-data.json'
REACTIONS = ['見逃し', 'ハーフスイング', '空振り']
OUTCOMES = {
    'pitch_changed': [False, True],
    'course_changed': [False, True],
    'next_pitch_group': ['ストレート', '変化球'],
    'next_course_height': ['高め', '真ん中', '低め'],
}
PERMUTATIONS = 100_000
SEED = 20_260_802


def contingency(transitions, reactions, outcome, categories):
    return [[sum(item['previous_reaction'] == reaction and item[outcome] == category
                 for item in transitions)
             for category in categories]
            for reaction in reactions]


def statistics(table):
    row_totals = [sum(row) for row in table]
    column_totals = [sum(row[column] for row in table)
                     for column in range(len(table[0]))]
    total = sum(row_totals)
    chi_square = sum(
        (table[row][column] - row_totals[row] * column_totals[column] / total) ** 2
        / (row_totals[row] * column_totals[column] / total)
        for row in range(len(table))
        for column in range(len(table[0]))
    )
    cramers_v = math.sqrt(
        chi_square / (total * min(len(table) - 1, len(table[0]) - 1))
    )
    return row_totals, column_totals, total, chi_square, cramers_v


def row_compositions(total, capacities):
    if len(capacities) == 1:
        if total <= capacities[0]:
            yield (total,)
        return
    minimum = max(0, total - sum(capacities[1:]))
    maximum = min(total, capacities[0])
    for value in range(minimum, maximum + 1):
        for rest in row_compositions(total - value, capacities[1:]):
            yield (value,) + rest


def exact_p(table):
    row_totals, column_totals, total, _, _ = statistics(table)
    constant = (sum(math.lgamma(value + 1) for value in row_totals)
                + sum(math.lgamma(value + 1) for value in column_totals)
                - math.lgamma(total + 1))

    def log_probability(candidate):
        return constant - sum(math.lgamma(value + 1)
                              for row in candidate for value in row)

    observed = log_probability(table)
    probability = 0.0

    def enumerate_tables(row_index, remaining_columns, rows):
        nonlocal probability
        if row_index == len(row_totals) - 1:
            if sum(remaining_columns) != row_totals[row_index]:
                return
            candidate = rows + [remaining_columns]
            candidate_probability = log_probability(candidate)
            if candidate_probability <= observed + 1e-12:
                probability += math.exp(candidate_probability)
            return
        for row in row_compositions(row_totals[row_index], remaining_columns):
            enumerate_tables(
                row_index + 1,
                [remaining_columns[index] - row[index]
                 for index in range(len(row))],
                rows + [list(row)],
            )

    enumerate_tables(0, column_totals, [])
    return min(1.0, probability)


def stratified_permutation_p(transitions, outcome, categories, rng):
    observed_table = contingency(transitions, REACTIONS, outcome, categories)
    observed_chi_square = statistics(observed_table)[3]
    participant_indices = {}
    for index, item in enumerate(transitions):
        participant_indices.setdefault(item['participant'], []).append(index)
    reactions = [item['previous_reaction'] for item in transitions]
    exceedances = 0

    for _ in range(PERMUTATIONS):
        shuffled = reactions.copy()
        for indices in participant_indices.values():
            values = [shuffled[index] for index in indices]
            rng.shuffle(values)
            for index, value in zip(indices, values):
                shuffled[index] = value
        copied = [dict(item, previous_reaction=shuffled[index])
                  for index, item in enumerate(transitions)]
        permuted_table = contingency(copied, REACTIONS, outcome, categories)
        if statistics(permuted_table)[3] >= observed_chi_square - 1e-12:
            exceedances += 1

    return (exceedances + 1) / (PERMUTATIONS + 1)


def main():
    with open(DATA_PATH, encoding='utf-8') as source:
        transitions = json.load(source)['transitions']
    rng = random.Random(SEED)

    for outcome, categories in OUTCOMES.items():
        table = contingency(transitions, REACTIONS, outcome, categories)
        _, _, _, chi_square, cramers_v = statistics(table)
        print(
            f'{outcome}: exact p={exact_p(table):.6f}, '
            f'participant-stratified p={stratified_permutation_p(transitions, outcome, categories, rng):.6f}, '
            f'chi2={chi_square:.6f}, V={cramers_v:.6f}'
        )


if __name__ == '__main__':
    main()
