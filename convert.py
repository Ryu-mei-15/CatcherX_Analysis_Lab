import pandas as pd
import glob
import json
import os

# CSVがあるディレクトリを絶対パスで指定します
DATA_DIR = '/Users/yamaguchimiyu/Downloads/Date'

# 指定ディレクトリ内のCSVを取得
csv_files = glob.glob(os.path.join(DATA_DIR, "*.csv"))
combined_data = []

print(f"探索先ディレクトリ: {DATA_DIR}")
print(f"見つかったCSVファイル数: {len(csv_files)}\n")

for file_path in csv_files:
    file_name = os.path.basename(file_path)
    
    # ファイル名から Dataset と 球速 を自動抽出
    # 例: "0_100.csv" -> parts = ["0", "100"]
    parts = file_name.replace(".csv", "").split("_")
    
    # "X_YYY.csv" の形式（アンダースコアで2つに分かれ，後半が数字）の場合
    if len(parts) == 2 and parts[1].isdigit():
        dataset_name = f"Dataset {parts[0]}"
        speed = f"{parts[1]} km/h"
    elif file_name.startswith('Log_Sub'):
        # テストログ用のフォールバック処理
        dataset_name = "Dataset Test"
        if '100' in file_name: speed = '100 km/h'
        elif '130' in file_name: speed = '130 km/h'
        elif '158' in file_name: speed = '158 km/h'
        else: speed = 'Unknown km/h'
    else:
        print(f"[-] スキップ: {file_name} (想定する命名規則 X_YYY.csv と異なります)")
        continue
        
    print(f"[+] 読み込み中: {file_name} -> {dataset_name}, {speed}")
    
    try:
        df = pd.read_csv(file_path)
        
        # 必要なカラムが存在するか確認しつつ抽出
        for _, row in df.iterrows():
            record = {
                "dataset": dataset_name,
                "speed": speed,
                "target_x": row.get("Target_Pos_X", 0),
                "target_y": row.get("Target_Pos_Y", 0),
                "target_z": row.get("Target_Pos_Z", 0),
                "mitt_x": row.get("Mitt_Catch_X", 0),
                "mitt_y": row.get("Mitt_Catch_Y", 0),
                "mitt_z": row.get("Mitt_Catch_Z", 0),
                "catch_result": str(row.get("Catch_Result", ""))
            }
            combined_data.append(record)
    except Exception as e:
        print(f"[!] エラー発生 ({file_name}): {e}")

# カレントディレクトリに data.json を出力
output_path = "data.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(combined_data, f, ensure_ascii=False, indent=2)

print(f"\n==============================================")
print(f"完了: 合計 {len(combined_data)} 件のログを {output_path} に書き出しました．")
print(f"==============================================")