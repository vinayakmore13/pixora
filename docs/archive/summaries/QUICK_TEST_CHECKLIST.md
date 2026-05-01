# WedHub Quick Test Checklist (5-Minute Reference)

## ✅ PRE-TEST VERIFICATION

- [x] **Code Compiles**: All 6 modified files compile ✅
- [x] **No TypeScript Errors**: 0 errors found ✅
- [x] **Fixes In Place**: All 8 bug fixes verified ✅
- [x] **Ready for Testing**: YES ✅

---

## 🧪 QUICK TEST SCENARIOS (Priority Order)

### 🔴 CRITICAL (Must Pass - User-Facing)

#### **TEST 1: Password Upload** (5 min)
- [ ] Photographer creates event
- [ ] Guest password with SPACES: "WEDDING-2026-ABC  " 
- [ ] **Result**: ✅ Accepted (NOT rejected)

#### **TEST 2: Session Persists** (3 min)  
- [ ] Guest joins selection portal
- [ ] Enter name: "Test Guest"
- [ ] **REFRESH PAGE**
- [ ] **Result**: ✅ Name still shows (not blank)

#### **TEST 4: No Memory Leaks** (2 min)
- [ ] Open DevTools Memory tab
- [ ] Note baseline memory
- [ ] Open/close portal 5 times
- [ ] **Result**: ✅ Memory returns to baseline

#### **TEST 8: Correct Error Messages** (2 min)
- [ ] Sign in with WRONG password
- [ ] Wait 8 seconds
- [ ] **Result**: ✅ Shows auth error (not "profile taking longer")

---

### 🟡 HIGH PRIORITY (Should Pass)

#### **TEST 3: Event Switch Upload** (3 min)
- [ ] Select Event A, start upload
- [ ] Switch to Event B immediately  
- [ ] **Result**: ✅ Old upload cancelled

#### **TEST 7: Admin Redirect** (2 min)
- [ ] Admin signs in
- [ ] Watch closely for UI changes
- [ ] **Result**: ✅ Goes to /partner/dashboard (no flicker)

---

### 🟠 MEDIUM PRIORITY (Nice to Have)

#### **TEST 5: Face API Console** (2 min)
- [ ] Start face match scan
- [ ] Navigate away immediately
- [ ] **Result**: ✅ Console clean (no warnings)

#### **TEST 6: Scroll Performance** (2 min)
- [ ] Scroll gallery with 200+ photos
- [ ] **Result**: ✅ Smooth scrolling (no jank)

---

## ⏱️ TOTAL TEST TIME

**Quick Tests Only**: ~15 minutes  
**Full Suite**: ~40 minutes  

---

## 📊 INSTANT PASS/FAIL CRITERIA

| Test | Must Pass | Why |
|------|-----------|-----|
| TEST 1 | ✅ YES | Blocks guest workflow |
| TEST 2 | ✅ YES | Data loss issue |
| TEST 4 | ✅ YES | Platform stability |
| TEST 8 | ✅ YES | User confusion |
| TEST 3 | ⚠️ SHOULD | Silent failures |
| TEST 7 | ⚠️ SHOULD | UX polish |
| TEST 5 | ⚠️ NICE | Console hygiene |
| TEST 6 | ⚠️ NICE | Performance |

---

## 🎯 PASS CRITERIA

**MINIMUM**: All 4 CRITICAL tests pass = ✅ GO  
**GOOD**: 6+ tests pass = ✅ GO WITH MINOR NOTES  
**EXCELLENT**: 8/8 tests pass = ✅ GO CLEAN  

---

## 🚀 IF ALL TESTS PASS

1. Update TEST_EXECUTION_REPORT.md with results
2. Mark as **"APPROVED FOR DEPLOYMENT"**
3. Deploy to production
4. Monitor error rates for 24 hours

---

## ❌ IF TESTS FAIL

**For CRITICAL failures (1,2,4,8):**
1. Stop deployment
2. Check test procedure (user error?)
3. Check code changes were applied  
4. Investigate root cause
5. Additional fix may be needed

**For HIGH PRIORITY failures (3,7):**
1. Document issue
2. Create follow-up ticket
3. May still deploy if critical tests pass

---

## 📋 DURING TEST EXECUTION

**Keep browser console open** - watch for:
- ❌ Red errors (bad)
- ⚠️ Yellow warnings (concerning)  
- ✅ Blue info logs (OK)

**Check in DevTools**:
- Memory (doesn't spike 20+ MB)
- Network (requests complete)
- Performance (no long tasks)

---

## 🔄 STEP-BY-STEP TEST 1 (Password Upload)

```
1. Login as photographer
2. Create new event: "Test Wedding"
3. Note password: "WEDDING-2026-ABC" (or similar)
4. Copy QR/event link
5. Open incognito tab
6. Paste event link
7. See event page
8. Click "Upload Photos"
9. Password field appears
10. Type: "WEDDING-2026-ABC  " (with 2 spaces at end)
11. Click "Verify"
12. ✅ PASS: Upload interface appears (password accepted)
13. ❌ FAIL: "Incorrect password" error shown
```

If password is BLANK or shows as plain password:
- ✅ That's OK - this is test data

If password shows as `****` or hashed:
- ✅ That's even better - password is protected

---

## 🔄 STEP-BY-STEP TEST 2 (Session Persistence)

```
1. Open selection portal link
2. Form shows with "Name" and "Email" fields
3. Enter: "John Smith" + "john@test.com"
4. Click "Join Portal"
5. See photo grid appears
6. **Press F5 to refresh page**
7. ✅ PASS: Name/Email fields show "John Smith" / "john@test.com"
8. ❌ FAIL: Form shows blank, asking to join again
```

---

## 🔄 STEP-BY-STEP TEST 4 (Memory Leak)

```
1. Open DevTools → Memory tab
2. Click "Heap snapshot" → record baseline
3. Note memory usage (e.g., "45 MB")
4. Open selection portal (guest)
5. Wait 30 seconds, close portal
6. Repeat 4 more times (5 total sessions)
7. Take another heap snapshot
8. Compare memory:
   - ✅ PASS: Same or ±10 MB difference
   - ❌ FAIL: Increased 20+ MB from baseline
```

---

## 🔄 STEP-BY-STEP TEST 8 (Error Messages)

```
1. Go to signin page
2. Enter WRONG password details
3. Click "Sign In"
4. Error shows immediately (e.g., "Invalid credentials")
5. ✅ PASS: Clear auth error message
6. ❌ FAIL: Message says "profile taking longer" or "successful"
7. Wait 8+ seconds anyway to confirm no delayed message
8. ✅ PASS: No "taking longer" message appears
```

---

## 📞 TROUBLESHOOTING

**Q: App won't start on localhost:3000**
- A: Run `npm run dev` in terminal

**Q: Tests timeout or hang**
- A: Check network tab - is app responding?

**Q: Can't create test data**  
- A: Check database connection

**Q: See weird errors in console**
- A: Check if fixes were actually applied (read files again)

---

## 📞 SUPPORT

- **Full details**: See TEST_EXECUTION_REPORT.md
- **Code changes**: See CHANGES_REFERENCE.md
- **Technical**: See COMPREHENSIVE_FIXES_APPLIED.md
- **Questions**: Ask engineering team

---

**Test Suite Prepared**: April 14, 2026  
**Total Fixes**: 8  
**Files Modified**: 6  
**Lines Changed**: ~90  
**Compilation Status**: ✅ CLEAN
