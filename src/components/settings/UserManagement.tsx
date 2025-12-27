import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Switch } from '../ui/switch'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/select'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { UserProfile, UserRole } from '../../context/AuthContext'
import { Users, Plus, Edit, Trash2, AlertCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

interface UserManagementProps {
    className?: string
}

export function UserManagement({ className }: UserManagementProps) {
    const { profile: currentUserProfile } = useAuth()
    const [users, setUsers] = useState<UserProfile[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<UserProfile | null>(null)
    const [formData, setFormData] = useState({
        email: '',
        username: '',
        full_name: '',
        role: 'usuario' as UserRole,
        password: '',
    })

    // Verificar se o usuário atual é admin
    const isAdmin = currentUserProfile?.role === 'admin'

    useEffect(() => {
        if (isAdmin) {
            fetchUsers()
        }
    }, [isAdmin])

    const fetchUsers = async () => {
        if (!isSupabaseConfigured || !isAdmin) return

        setIsLoading(true)
        setError(null)

        try {
            const { data, error: fetchError } = await supabase
                .from('user_profiles')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            setUsers(data || [])
        } catch (err: any) {
            console.error('Error fetching users:', err)
            setError(err.message || 'Erro ao carregar usuários')
        } finally {
            setIsLoading(false)
        }
    }

    const handleOpenDialog = (user?: UserProfile) => {
        if (user) {
            setEditingUser(user)
            setFormData({
                email: user.email,
                username: user.username || '',
                full_name: user.full_name || '',
                role: user.role,
                password: '',
            })
        } else {
            setEditingUser(null)
            setFormData({
                email: '',
                username: '',
                full_name: '',
                role: 'usuario',
                password: '',
            })
        }
        setIsDialogOpen(true)
    }

    const handleCloseDialog = () => {
        setIsDialogOpen(false)
        setEditingUser(null)
        setFormData({
            email: '',
            username: '',
            full_name: '',
            role: 'usuario',
            password: '',
        })
        setError(null)
    }

    const handleCreateUser = async () => {
        if (!isSupabaseConfigured || !isAdmin) return

        setError(null)

        // Validação
        if (!formData.email || !formData.password) {
            setError('Email e senha são obrigatórios')
            return
        }

        try {
            // Criar usuário no auth
            const { data: authData, error: authError } = await supabase.auth.admin?.createUser({
                email: formData.email,
                password: formData.password,
                email_confirm: true,
                user_metadata: {
                    username: formData.username || null,
                    full_name: formData.full_name || null,
                }
            })

            if (authError) {
                // Se não temos admin access, informar ao usuário
                if (authError.message.includes('admin') || authError.message.includes('service_role')) {
                    setError('Criação de usuários requer acesso de administrador do Supabase. Para habilitar, configure o Service Role Key no backend ou use o painel do Supabase para criar usuários manualmente.')
                    return
                }
                throw authError
            }

            if (authData?.user) {
                // Atualizar perfil do usuário
                const { error: profileError } = await supabase
                    .from('user_profiles')
                    .update({
                        username: formData.username || null,
                        full_name: formData.full_name || null,
                        role: formData.role,
                    })
                    .eq('id', authData.user.id)

                if (profileError) {
                    console.error('Error updating profile:', profileError)
                }

                await fetchUsers()
                handleCloseDialog()
            }
        } catch (err: any) {
            console.error('Error creating user:', err)
            setError(err.message || 'Erro ao criar usuário')
        }
    }

    const handleUpdateUser = async () => {
        if (!isSupabaseConfigured || !isAdmin || !editingUser) return

        setError(null)

        try {
            const updates: Partial<UserProfile> = {
                username: formData.username || null,
                full_name: formData.full_name || null,
                role: formData.role,
            }

            // Atualizar email se necessário
            if (formData.email !== editingUser.email) {
                const { error: emailError } = await supabase.auth.admin?.updateUserById(
                    editingUser.id,
                    { email: formData.email }
                )
                if (emailError) {
                    if (emailError.message.includes('admin')) {
                        setError('Não é possível alterar o email sem acesso de administrador do Supabase.')
                        return
                    }
                    throw emailError
                }
                updates.email = formData.email
            }

            // Atualizar senha se fornecida
            if (formData.password) {
                const { error: passwordError } = await supabase.auth.admin?.updateUserById(
                    editingUser.id,
                    { password: formData.password }
                )
                if (passwordError) {
                    if (passwordError.message.includes('admin')) {
                        setError('Não é possível alterar a senha sem acesso de administrador do Supabase.')
                        return
                    }
                    throw passwordError
                }
            }

            // Atualizar perfil
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update(updates)
                .eq('id', editingUser.id)

            if (updateError) throw updateError

            await fetchUsers()
            handleCloseDialog()
        } catch (err: any) {
            console.error('Error updating user:', err)
            setError(err.message || 'Erro ao atualizar usuário')
        }
    }

    const handleToggleEnabled = async (user: UserProfile, enabled: boolean) => {
        if (!isSupabaseConfigured || !isAdmin) return

        try {
            // Tentar atualizar campo enabled (pode não existir ainda na tabela)
            // Se não existir, o erro será ignorado e o usuário poderá adicionar o campo via SQL
            const { error: updateError } = await supabase
                .from('user_profiles')
                .update({ enabled: enabled })
                .eq('id', user.id)

            if (updateError) {
                // Se o campo não existir, mostrar instrução
                if (updateError.message.includes('column') && updateError.message.includes('does not exist')) {
                    setError('Campo "enabled" não encontrado. Execute o SQL: ALTER TABLE user_profiles ADD COLUMN enabled BOOLEAN DEFAULT true;')
                    return
                }
                throw updateError
            }

            await fetchUsers()
        } catch (err: any) {
            console.error('Error toggling user status:', err)
            setError(err.message || 'Erro ao alterar status do usuário')
        }
    }

    const handleDeleteUser = async (user: UserProfile) => {
        if (!isSupabaseConfigured || !isAdmin) return

        if (!window.confirm(`Tem certeza que deseja excluir o usuário ${user.email}? Esta ação não pode ser desfeita.`)) {
            return
        }

        try {
            // Deletar usuário do auth (cascata vai deletar o perfil)
            const { error: deleteError } = await supabase.auth.admin?.deleteUser(user.id)
            
            if (deleteError) {
                if (deleteError.message.includes('admin')) {
                    setError('Não é possível excluir usuários sem acesso de administrador do Supabase.')
                    return
                }
                throw deleteError
            }

            await fetchUsers()
        } catch (err: any) {
            console.error('Error deleting user:', err)
            setError(err.message || 'Erro ao excluir usuário')
        }
    }

    if (!isAdmin) {
        return (
            <Card className={className}>
                <CardHeader>
                    <CardTitle>Gerenciamento de Usuários</CardTitle>
                    <CardDescription>
                        Acesso restrito a administradores
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <AlertCircle className="w-4 h-4" />
                        <p>Você não tem permissão para acessar esta funcionalidade.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className={className}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users className="w-5 h-5" />
                            Gerenciamento de Usuários
                        </CardTitle>
                        <CardDescription>
                            Cadastre, edite e gerencie usuários do sistema
                        </CardDescription>
                    </div>
                    <Button onClick={() => handleOpenDialog()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Usuário
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {error && (
                    <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
                        {error}
                    </div>
                )}

                {isLoading ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Carregando usuários...
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Nenhum usuário encontrado
                    </div>
                ) : (
                    <div className="space-y-2">
                        {users.map((user) => {
                            const userEnabled = (user as any).enabled !== false // Default true se campo não existir
                            return (
                                <div
                                    key={user.id}
                                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="font-medium">{user.full_name || user.email}</p>
                                            <span className="text-xs px-2 py-1 bg-secondary rounded">
                                                {user.role}
                                            </span>
                                            {!userEnabled && (
                                                <span className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded">
                                                    Desabilitado
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-muted-foreground mt-1">
                                            <p>{user.email}</p>
                                            {user.username && <p>@{user.username}</p>}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2">
                                            <Label htmlFor={`enabled-${user.id}`} className="text-sm">
                                                {userEnabled ? 'Ativo' : 'Inativo'}
                                            </Label>
                                            <Switch
                                                id={`enabled-${user.id}`}
                                                checked={userEnabled}
                                                onCheckedChange={(checked) => handleToggleEnabled(user, checked)}
                                                disabled={user.id === currentUserProfile?.id}
                                            />
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleOpenDialog(user)}
                                        >
                                            <Edit className="w-4 h-4" />
                                        </Button>
                                        {user.id !== currentUserProfile?.id && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleDeleteUser(user)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}

                {/* Dialog para criar/editar usuário */}
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </DialogTitle>
                            <DialogDescription>
                                {editingUser
                                    ? 'Atualize as informações do usuário'
                                    : 'Preencha os dados para criar um novo usuário'}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="email">Email *</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="username">Nome de Usuário</Label>
                                <Input
                                    id="username"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    placeholder="opcional"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="full_name">Nome Completo</Label>
                                <Input
                                    id="full_name"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                                    placeholder="opcional"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="role">Função</Label>
                                <Select
                                    value={formData.role}
                                    onValueChange={(value: UserRole) =>
                                        setFormData({ ...formData, role: value })
                                    }
                                >
                                    <SelectTrigger id="role">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="usuario">Usuário</SelectItem>
                                        <SelectItem value="gerente">Gerente</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="password">
                                    {editingUser ? 'Nova Senha (deixe em branco para não alterar)' : 'Senha *'}
                                </Label>
                                <Input
                                    id="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleCloseDialog}>
                                Cancelar
                            </Button>
                            <Button
                                onClick={editingUser ? handleUpdateUser : handleCreateUser}
                            >
                                {editingUser ? 'Salvar' : 'Criar'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}

