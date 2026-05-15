import pickle, json, numpy as np, pandas as pd

BASE   = r'C:\Users\ASUS\Desktop\Projects\Sailesh SIr\ClinicalGuard\backend\temp'
MODELS = r'C:\Users\ASUS\Desktop\Projects\Sailesh SIr\ClinicalGuard\backend\models'

with open(BASE+'/xgb_model.pkl','rb') as f: xgb=pickle.load(f)
with open(BASE+'/rf_model.pkl','rb') as f:  rf=pickle.load(f)
with open(BASE+'/dt_model.pkl','rb') as f:  dt=pickle.load(f)
with open(BASE+'/scaler.pkl','rb') as f:    scaler=pickle.load(f)
with open(BASE+'/feature_cols.json') as f:  FEAT=json.load(f)

print("Feature cols:", FEAT)
print("Scaler bp_systolic max:", round(scaler.data_max_[FEAT.index('bp_systolic')],1), "(must be <=170)")
print()

SANITY = [
    ("Healthy patient",             [35,115,75,90,68,99,4,1,2,1,0.12,1,0], 1),
    ("SFO: high BP HRS=0.05",       [52,148,95,165,105,92,2,2,1,0,0.05,1,0], 0),
    ("VSM: normal vitals HRS=0.72", [45,132,85,118,94,96,1,1,1,1,0.72,1,0], 0),
    ("TSF: high risk outcome=1",    [58,155,98,175,108,90,2,2,2,1,0.78,1,0], 0),
    ("Elderly authentic",           [68,135,85,130,78,96,1,3,1,1,0.42,0,1], 1),
]

all_pass = True
for desc, vals, expected in SANITY:
    arr = np.array(vals, dtype=float).reshape(1,-1)
    arr_sc = scaler.transform(arr)
    def chk(m, name):
        p = int(m.predict(arr_sc)[0])
        c = m.predict_proba(arr_sc)[0][p]*100
        ok  = "PASS" if p==expected else "FAIL"
        lbl = "AUTH" if p==1 else "MANIP"
        return f"{ok} {lbl}({c:.0f}%)"
    xr = chk(xgb,"XGB"); rr = chk(rf,"RF"); dr = chk(dt,"DT")
    if "FAIL" in xr: all_pass = False
    print(f"{desc:<38}  XGB={xr}  RF={rr}  DT={dr}")

print()
if all_pass:
    print("ALL SANITY CHECKS PASSED - safe to deploy")
else:
    print("SOME SANITY CHECKS FAILED - investigate before deploy")
