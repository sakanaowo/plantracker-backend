# HƯỚNG DẪN TÍCH HỢP AUTH MODULE VÀO CLEAN ARCHITECTURE
**Ngày tạo:** 14/10/2025  
**Trạng thái:** Auth module ĐÃ CÓ SẴN - Chỉ cần tích hợp

---

## ✅ PHÁT HIỆN QUAN TRỌNG

Project **ĐÃ CÓ SẴN Auth module hoàn chỉnh** tại:
```
app/src/main/java/com/example/tralalero/auth/
├── remote/              # API và Firebase integration
│   ├── AuthApi.java                    ✅ Có sẵn
│   ├── AuthManager.java                ✅ Có sẵn
│   ├── PublicAuthApi.java              ✅ Có sẵn
│   ├── FirebaseAuthenticator.java      ✅ Có sẵn
│   ├── FirebaseInterceptor.java        ✅ Có sẵn
│   └── dto/
│       ├── FirebaseAuthDto.java        ✅ Có sẵn
│       └── UpdateProfileRequest.java   ✅ Có sẵn
│
├── repository/          # Repository implementation
│   └── FirebaseAuthRepository.java     ✅ Có sẵn
│
└── storage/            # Token management
    └── TokenManager.java               ✅ Có sẵn
```

**Kết luận:** Auth module hoàn chỉnh, chỉ cần tạo **Adapter** để kết nối với Clean Architecture.

---

## 📋 CÁC THÀNH PHẦN ĐÃ CÓ

### **1. TokenManager** ✅ (auth/storage/TokenManager.java)

**Chức năng hiện có:**
- ✅ `saveAuthData(token, userId, email, name)` - Lưu Firebase ID token
- ✅ `getFirebaseIdToken()` - Lấy token
- ✅ `getUserId()`, `getUserEmail()`, `getUserName()` - Lấy user info
- ✅ `isLoggedIn()` - Kiểm tra đăng nhập
- ✅ `clearAuthData()` - Logout
- ✅ `clearAll()` - Xóa hết data

**Lưu ý:** TokenManager đã hoàn chỉnh, không cần chỉnh sửa!

---

### **2. AuthApi** ✅ (auth/remote/AuthApi.java)

**Endpoints đã có:**
- ✅ `POST /users/local/signin` - Login email/password
- ✅ `POST /users/local/signup` - Register
- ✅ `POST /users/firebase/auth` - Firebase authentication
- ✅ `GET /users/me` - Get current user
- ✅ `PATCH /users/me` - Update profile
- ✅ `DELETE /users/me` - Delete account

**Lưu ý:** API đã đầy đủ các endpoint cần thiết!

---

### **3. FirebaseAuthRepository** ✅ (auth/repository/FirebaseAuthRepository.java)

**Chức năng hiện có:**
- ✅ `authenticateWithFirebase(idToken, callback)` - Xác thực với Firebase
- ✅ `getAuthenticatedApi()` - Lấy API đã authenticated
- ✅ Sử dụng `PublicAuthApi` cho initial auth (không cần Authorization header)
- ✅ Sử dụng `AuthApi` cho protected endpoints

**Lưu ý:** Repository đã handle Firebase authentication flow!

---

### **4. DTOs** ✅

**Đã có:**
- ✅ `LoginRequest.java` - Email/password login
- ✅ `LoginResponse.java` - Login response
- ✅ `FirebaseAuthDto.java` - Firebase ID token wrapper
- ✅ `FirebaseAuthResponse.java` - Firebase auth response
- ✅ `UserDto.java` - User data transfer object
- ✅ `UpdateProfileRequest.java` - Update profile request

---

## 🔄 KIẾN TRÚC HIỆN TẠI VS CLEAN ARCHITECTURE

### **Kiến trúc hiện tại (Firebase-based):**
```
LoginActivity 
    ↓
FirebaseAuth.signIn() 
    ↓
Get Firebase ID Token 
    ↓
FirebaseAuthRepository.authenticateWithFirebase() 
    ↓
Backend validates Firebase token 
    ↓
TokenManager.saveAuthData() 
    ↓
Navigate to Home
```

### **Clean Architecture mới (cần tích hợp):**
```
LoginActivity 
    ↓
LoginUseCase.execute() 
    ↓
IAuthRepository.login() ← [Adapter cần tạo]
    ↓
FirebaseAuthRepository (existing) 
    ↓
TokenManager (existing)
```

---

## 🚀 CÁCH TÍCH HỢP - CHỈ CẦN TẠO ADAPTER

Vì Auth module đã có sẵn, chúng ta chỉ cần tạo **1 Adapter class** để wrap `FirebaseAuthRepository` vào `IAuthRepository`.

### **BƯỚC 1: Tạo AuthRepositoryImpl (Adapter)**

**Location:** `data/repository/AuthRepositoryImpl.java`

**Chức năng:** 
- Implement `IAuthRepository` interface (Clean Architecture)
- Wrap existing `FirebaseAuthRepository` và `TokenManager`
- Adapt callbacks giữa 2 kiến trúc

```java
package com.example.tralalero.data.repository;

import android.content.Context;

import com.example.tralalero.auth.remote.AuthManager;
import com.example.tralalero.auth.repository.FirebaseAuthRepository;
import com.example.tralalero.auth.storage.TokenManager;
import com.example.tralalero.data.mapper.UserMapper;
import com.example.tralalero.data.remote.dto.auth.FirebaseAuthResponse;
import com.example.tralalero.data.remote.dto.auth.LoginResponse;
import com.example.tralalero.data.remote.dto.auth.UserDto;
import com.example.tralalero.domain.model.User;
import com.example.tralalero.domain.repository.IAuthRepository;
import com.google.firebase.auth.FirebaseAuth;
import com.google.firebase.auth.FirebaseUser;

import retrofit2.Call;
import retrofit2.Callback;
import retrofit2.Response;

/**
 * Adapter class: Kết nối Auth module hiện có với Clean Architecture
 * 
 * Wrap existing components:
 * - FirebaseAuthRepository (existing)
 * - TokenManager (existing)
 * - FirebaseAuth (Firebase SDK)
 */
public class AuthRepositoryImpl implements IAuthRepository {
    
    private final FirebaseAuth firebaseAuth;
    private final FirebaseAuthRepository firebaseAuthRepository;
    private final TokenManager tokenManager;
    private final AuthManager authManager;
    private final UserMapper userMapper;
    
    public AuthRepositoryImpl(Context context) {
        this.firebaseAuth = FirebaseAuth.getInstance();
        this.authManager = new AuthManager(context);
        this.firebaseAuthRepository = new FirebaseAuthRepository(authManager);
        this.tokenManager = new TokenManager(context);
        this.userMapper = new UserMapper();
    }
    
    @Override
    public void login(String email, String password, RepositoryCallback<AuthResult> callback) {
        // Step 1: Sign in with Firebase
        firebaseAuth.signInWithEmailAndPassword(email, password)
            .addOnSuccessListener(authResult -> {
                FirebaseUser firebaseUser = authResult.getUser();
                if (firebaseUser == null) {
                    callback.onError("Firebase user is null");
                    return;
                }
                
                // Step 2: Get Firebase ID token
                firebaseUser.getIdToken(true)
                    .addOnSuccessListener(getTokenResult -> {
                        String idToken = getTokenResult.getToken();
                        
                        // Step 3: Authenticate with backend
                        firebaseAuthRepository.authenticateWithFirebase(idToken, 
                            new FirebaseAuthRepository.FirebaseAuthCallback() {
                                @Override
                                public void onSuccess(FirebaseAuthResponse response, String firebaseIdToken) {
                                    // Step 4: Save auth data
                                    tokenManager.saveAuthData(
                                        firebaseIdToken,
                                        response.getUser().getId(),
                                        response.getUser().getEmail(),
                                        response.getUser().getName()
                                    );
                                    
                                    // Step 5: Convert to domain model
                                    User user = userMapper.toDomain(response.getUser());
                                    AuthResult authResult = new AuthResult(user, firebaseIdToken, null);
                                    
                                    callback.onSuccess(authResult);
                                }
                                
                                @Override
                                public void onError(String error) {
                                    callback.onError("Backend auth failed: " + error);
                                }
                            });
                    })
                    .addOnFailureListener(e -> {
                        callback.onError("Failed to get Firebase token: " + e.getMessage());
                    });
            })
            .addOnFailureListener(e -> {
                callback.onError("Firebase login failed: " + e.getMessage());
            });
    }
    
    @Override
    public void logout(RepositoryCallback<Void> callback) {
        // Step 1: Sign out from Firebase
        firebaseAuth.signOut();
        
        // Step 2: Clear stored tokens
        tokenManager.clearAuthData();
        
        callback.onSuccess(null);
    }
    
    @Override
    public void getCurrentUser(RepositoryCallback<User> callback) {
        // Use authenticated API to get current user
        firebaseAuthRepository.getAuthenticatedApi().getMe()
            .enqueue(new Callback<UserDto>() {
                @Override
                public void onResponse(Call<UserDto> call, Response<UserDto> response) {
                    if (response.isSuccessful() && response.body() != null) {
                        User user = userMapper.toDomain(response.body());
                        callback.onSuccess(user);
                    } else {
                        callback.onError("Failed to get user: " + response.message());
                    }
                }
                
                @Override
                public void onFailure(Call<UserDto> call, Throwable t) {
                    callback.onError("Network error: " + t.getMessage());
                }
            });
    }
    
    @Override
    public boolean isLoggedIn() {
        return tokenManager.isLoggedIn();
    }
    
    @Override
    public void refreshToken(String refreshToken, RepositoryCallback<String> callback) {
        // Firebase handles token refresh automatically
        FirebaseUser currentUser = firebaseAuth.getCurrentUser();
        if (currentUser != null) {
            currentUser.getIdToken(true)
                .addOnSuccessListener(result -> {
                    String newToken = result.getToken();
                    // Update stored token
                    tokenManager.saveAuthData(
                        newToken,
                        tokenManager.getUserId(),
                        tokenManager.getUserEmail(),
                        tokenManager.getUserName()
                    );
                    callback.onSuccess(newToken);
                })
                .addOnFailureListener(e -> {
                    callback.onError("Token refresh failed: " + e.getMessage());
                });
        } else {
            callback.onError("No user logged in");
        }
    }
}
```

**Giải thích:**
- Adapter này **KHÔNG thay đổi** Auth module hiện có
- Chỉ wrap các component hiện có vào Clean Architecture interface
- Giữ nguyên Firebase authentication flow
- Tái sử dụng 100% code hiện có

---

## 📝 CÁCH SỬ DỤNG SAU KHI TÍCH HỢP

### **Ví dụ 1: Login trong Activity**

```java
public class LoginActivity extends AppCompatActivity {
    
    private LoginUseCase loginUseCase;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Initialize Clean Architecture components
        IAuthRepository authRepository = new AuthRepositoryImpl(this);
        loginUseCase = new LoginUseCase(authRepository);
        
        btnLogin.setOnClickListener(v -> {
            String email = etEmail.getText().toString();
            String password = etPassword.getText().toString();
            
            // Use Clean Architecture UseCase
            loginUseCase.execute(email, password, new LoginUseCase.Callback<IAuthRepository.AuthResult>() {
                @Override
                public void onSuccess(IAuthRepository.AuthResult result) {
                    Toast.makeText(LoginActivity.this, 
                        "Welcome " + result.getUser().getName(), 
                        Toast.LENGTH_SHORT).show();
                    
                    startActivity(new Intent(LoginActivity.this, HomeActivity.class));
                    finish();
                }
                
                @Override
                public void onError(String error) {
                    Toast.makeText(LoginActivity.this, error, Toast.LENGTH_SHORT).show();
                }
            });
        });
    }
}
```

### **Ví dụ 2: Check login status trong Splash**

```java
public class SplashActivity extends AppCompatActivity {
    
    private IsLoggedInUseCase isLoggedInUseCase;
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        IAuthRepository authRepository = new AuthRepositoryImpl(this);
        isLoggedInUseCase = new IsLoggedInUseCase(authRepository);
        
        // Check login status
        if (isLoggedInUseCase.execute()) {
            // Already logged in → Go to Home
            startActivity(new Intent(this, HomeActivity.class));
        } else {
            // Not logged in → Go to Login
            startActivity(new Intent(this, LoginActivity.class));
        }
        finish();
    }
}
```

### **Ví dụ 3: Logout**

```java
public class ProfileActivity extends AppCompatActivity {
    
    private LogoutUseCase logoutUseCase;
    
    private void logout() {
        IAuthRepository authRepository = new AuthRepositoryImpl(this);
        logoutUseCase = new LogoutUseCase(authRepository);
        
        logoutUseCase.execute(new LogoutUseCase.Callback<Void>() {
            @Override
            public void onSuccess(Void result) {
                Toast.makeText(ProfileActivity.this, "Logged out", Toast.LENGTH_SHORT).show();
                
                // Navigate to Login
                Intent intent = new Intent(ProfileActivity.this, LoginActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(intent);
                finish();
            }
            
            @Override
            public void onError(String error) {
                Toast.makeText(ProfileActivity.this, error, Toast.LENGTH_SHORT).show();
            }
        });
    }
}
```

---

## ✅ CHECKLIST TRIỂN KHAI

### **Phase 3 - Auth Integration**

- [x] **Auth module hiện có** (Đã có sẵn 100%)
  - [x] TokenManager
  - [x] AuthApi
  - [x] FirebaseAuthRepository
  - [x] FirebaseAuthenticator
  - [x] FirebaseInterceptor
  - [x] DTOs (LoginRequest, LoginResponse, UserDto, etc.)

- [ ] **Clean Architecture Integration** (Cần tạo)
  - [x] IAuthRepository interface (Đã tạo)
  - [x] Auth UseCases (Đã tạo 4 UseCases)
  - [ ] AuthRepositoryImpl (Adapter) ← **CHỈ CẦN TẠO FILE NÀY**

---

## 🎯 TỔNG KẾT

### **Những gì ĐÃ CÓ:**
✅ Auth module hoàn chỉnh (Firebase + Backend integration)  
✅ TokenManager (lưu trữ token)  
✅ AuthApi (Retrofit endpoints)  
✅ FirebaseAuthRepository (Firebase authentication)  
✅ IAuthRepository interface (Clean Architecture)  
✅ 4 Auth UseCases (Login, Logout, GetCurrentUser, IsLoggedIn)  

### **Những gì CẦN LÀM:**
⏳ Tạo **1 file duy nhất**: `AuthRepositoryImpl.java` (Adapter)  

**Thời gian ước tính:** 30 phút - 1 giờ

---

## 💡 LỢI ÍCH CỦA CÁCH TIẾP CẬN NÀY

1. **Không phá vỡ code hiện có** - Auth module vẫn hoạt động như cũ
2. **Tái sử dụng 100%** - Không duplicate code
3. **Clean Architecture** - Tách biệt business logic
4. **Dễ test** - Có thể mock IAuthRepository
5. **Tương lai** - Dễ thay đổi implementation (VD: từ Firebase sang OAuth)

---

## 📌 LƯU Ý QUAN TRỌNG

### **Firebase Authentication Flow:**

Auth hiện tại sử dụng Firebase, flow như sau:
1. User nhập email/password
2. Firebase SDK authenticate
3. Lấy Firebase ID Token
4. Gửi ID Token lên backend để validate
5. Backend trả về user data
6. Lưu token và user info vào SharedPreferences

**Adapter AuthRepositoryImpl phải tuân thủ flow này!**

---

## 🚀 BƯỚC TIẾP THEO

Bạn có 2 lựa chọn:

### **Option 1: Tạo AuthRepositoryImpl ngay (Khuyến nghị)**
Tôi có thể tạo file `AuthRepositoryImpl.java` để hoàn thiện Auth integration.

**Ưu điểm:**
- Auth module hoàn chỉnh
- Có thể test login/logout flow
- Sẵn sàng cho Phase 4 (ViewModels)

### **Option 2: Chuyển sang Phase 4**
Bắt đầu tạo ViewModels cho các module khác, quay lại Auth sau.

**Lưu ý:** Auth cần có trước khi test UI flow đầy đủ.

---

## 📞 HỖ TRỢ

Nếu bạn muốn tôi:
1. ✅ Tạo file `AuthRepositoryImpl.java` (Adapter)
2. ✅ Tạo UserMapper nếu chưa có
3. ✅ Test Auth flow
4. ✅ Tích hợp vào LoginActivity hiện có

Hãy cho tôi biết! 🚀

